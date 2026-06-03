from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
import subprocess
import tempfile
from pathlib import Path

from ..config import settings
from ..schemas import FactSheet
from .base import ProgressFn, VideoAnalysisProvider
from ._shared import SYSTEM_PROMPT, extract_json

log = logging.getLogger(__name__)

# --- Blur-aware sampling constants (thesis instantiation, Stage 3) ---------
# These mirror the frozen pipeline configuration and stay module-local on
# purpose; only the per-second sampling rate is exposed as a tunable knob.
CANDIDATES_PER_POINT = 11        # candidate frames probed per sample point
CANDIDATE_SPACING_S = 0.1        # spacing between candidates, in seconds
BLUR_LAPLACIAN_WEIGHT = 0.7      # weight on Laplacian variance
BLUR_CANNY_WEIGHT = 30.0         # weight on Canny edge density
BLUR_EARLY_STOP = 170.0          # score that ends the candidate search early

# Stage 2 — turn a voiceover transcript into time-windowed topic tags. This is the
# open-vocabulary analog of the thesis' taxonomy-bound pre-structuring: instead of
# tagging fixed top-categories, the model discovers feature themes from the speech.
PRESTRUCTURE_PROMPT = """You are given the voiceover transcript of a video, as timestamped segments.
Identify the time windows in which digital features, connectivity, or user-interface
elements are discussed. For each such window, output the topics mentioned as short free-form
labels (you choose them — no fixed taxonomy).

Return ONLY a JSON object of this shape:
{
  "segments": [
    {"t_start": <sec>, "t_end": <sec>, "topics": ["<short label>", ...], "note": "<what is said>"}
  ]
}
Use the timestamps from the provided segments. Omit windows that contain no feature/UI talk.
"""


def _blur_score(gray) -> float:
    """Sharpness score: Laplacian variance + Canny edge density (thesis formula)."""
    import cv2

    lap_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    edges = cv2.Canny(gray, 100, 200)
    edge_density = float(edges.mean()) / 255.0  # fraction of edge pixels in [0, 1]
    return BLUR_LAPLACIAN_WEIGHT * lap_var + BLUR_CANNY_WEIGHT * edge_density


def _seg_attr(seg, key: str):
    """Read a transcription-segment field whether it's an object or a dict."""
    if isinstance(seg, dict):
        return seg.get(key)
    return getattr(seg, key, None)


class OpenAIFramesProvider(VideoAnalysisProvider):
    """Multimodal frame-sampling provider (thesis-style cascaded late fusion).

    Stage 1 transcribes the audio (OpenAI API), Stage 2 pre-structures the voiceover
    into time-windowed topic hints, Stage 3 samples frames (blur-aware), Stage 4 runs
    GPT vision over frame batches with the overlapping voiceover hints injected, and
    Stage 5 consolidates the per-batch results with the transcript (late fusion).
    A single unified model is used for every LLM/vision call.
    """

    name = "openai"

    def __init__(
        self,
        *,
        model: str | None = None,
        sample_fps: float | None = None,
        vision_detail: str | None = None,
        batch_size: int | None = None,
        use_audio: bool | None = None,
    ) -> None:
        self.model = model or settings.openai_model
        self.sample_fps = sample_fps or settings.sample_fps
        self.vision_detail = vision_detail or settings.openai_vision_detail
        self.batch_size = batch_size or settings.openai_batch_size
        self.use_audio = settings.openai_use_audio if use_audio is None else use_audio

    # -- Stage 1: transcription (OpenAI API) --------------------------------
    def _transcribe(self, client, video_path: Path) -> tuple[str, list[dict]]:
        """Return (full_text, [{t_start, t_end, text}]). Empty on no audio / failure."""
        if not self.use_audio:
            return "", []

        audio_path, cleanup = self._extract_audio(video_path)
        try:
            with open(audio_path, "rb") as f:
                tr = client.audio.transcriptions.create(
                    model=settings.openai_transcribe_model,
                    file=f,
                    response_format="verbose_json",
                )
        except Exception as e:
            log.warning("openai_frames: transcription failed (%s) — vision-only fallback", e)
            return "", []
        finally:
            if cleanup:
                os.unlink(audio_path)

        segments = [
            {
                "t_start": float(_seg_attr(s, "start") or 0.0),
                "t_end": float(_seg_attr(s, "end") or 0.0),
                "text": (_seg_attr(s, "text") or "").strip(),
            }
            for s in (getattr(tr, "segments", None) or [])
        ]
        full_text = getattr(tr, "text", "") or ""
        log.info("openai_frames: transcript has %d segments", len(segments))
        return full_text, segments

    def _extract_audio(self, video_path: Path) -> tuple[str, bool]:
        """Extract a compact mono audio track via ffmpeg. Falls back to the raw video.

        Returns (path, cleanup) — cleanup=True means the caller must delete the file.
        """
        fd, tmp = tempfile.mkstemp(suffix=".mp3")
        os.close(fd)
        try:
            subprocess.run(
                ["ffmpeg", "-y", "-i", str(video_path), "-vn",
                 "-ac", "1", "-ar", "16000", "-b:a", "64k", tmp],
                check=True, capture_output=True,
            )
            return tmp, True
        except FileNotFoundError:
            os.unlink(tmp)
            log.warning("openai_frames: ffmpeg not found — sending video file directly")
            return str(video_path), False
        except subprocess.CalledProcessError as e:
            os.unlink(tmp)
            log.warning("openai_frames: ffmpeg failed (%s) — sending video file directly",
                        e.stderr.decode("utf-8", "ignore")[-200:] if e.stderr else e)
            return str(video_path), False

    # -- Stage 2: voiceover pre-structuring ---------------------------------
    def _prestructure(self, client, segments: list[dict]) -> list[dict]:
        """Tag time windows with discovered topics (open-vocabulary). [] if no transcript."""
        if not segments:
            return []
        payload = [{"t_start": s["t_start"], "t_end": s["t_end"], "text": s["text"]}
                   for s in segments]
        resp = client.chat.completions.create(
            model=self.model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": PRESTRUCTURE_PROMPT},
                {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
            ],
        )
        data = extract_json(resp.choices[0].message.content or "")
        windows = data.get("segments", []) if isinstance(data, dict) else []
        log.info("openai_frames: pre-structured %d voiceover window(s)", len(windows))
        return windows

    def _hints_for_range(self, windows: list[dict], t_lo: float, t_hi: float) -> str:
        """Build a voiceover-context block for windows overlapping [t_lo, t_hi]."""
        lines: list[str] = []
        for w in windows:
            try:
                ws, we = float(w.get("t_start", 0)), float(w.get("t_end", 0))
            except (TypeError, ValueError):
                continue
            if we >= t_lo and ws <= t_hi:
                topics = ", ".join(w.get("topics", []) or [])
                note = (w.get("note") or "").strip()
                lines.append(f"- {ws:.1f}–{we:.1f}s: {topics}" + (f" — {note}" if note else ""))
        if not lines:
            return ""
        return (
            "Voiceover context for these timestamps (use as focus hints, not an exhaustive "
            "or restrictive list — still report anything else you see):\n" + "\n".join(lines)
        )

    # -- Stage 3: blur-aware frame sampling ---------------------------------
    def _sample_frames(self, video_path: Path) -> list[tuple[float, bytes]]:
        """Return [(timestamp_seconds, jpeg_bytes)] using blur-aware sampling."""
        import cv2

        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            raise RuntimeError(f"OpenCV could not open video: {video_path}")

        video_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0
        duration = frame_count / video_fps if video_fps else 0.0

        step = 1.0 / self.sample_fps if self.sample_fps > 0 else 1.0
        frames: list[tuple[float, bytes]] = []

        t = 0.0
        while t < max(duration, step):
            best_score = -1.0
            best_jpeg: bytes | None = None
            best_t = t
            for i in range(CANDIDATES_PER_POINT):
                ct = t + i * CANDIDATE_SPACING_S
                if duration and ct >= duration:
                    break
                cap.set(cv2.CAP_PROP_POS_MSEC, ct * 1000.0)
                ok, frame = cap.read()
                if not ok or frame is None:
                    continue
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                score = _blur_score(gray)
                if score > best_score:
                    ok_enc, buf = cv2.imencode(".jpg", frame)
                    if ok_enc:
                        best_score = score
                        best_jpeg = buf.tobytes()
                        best_t = ct
                if score >= BLUR_EARLY_STOP:
                    break  # sharp enough — stop probing this sample point
            if best_jpeg is not None:
                frames.append((best_t, best_jpeg))
            t += step

        cap.release()
        log.info("openai_frames: sampled %d frames from %s", len(frames), video_path.name)
        return frames

    # -- Stage 4: vision over frame batches ---------------------------------
    def _vision_batch(
        self,
        client,
        frames: list[tuple[float, bytes]],
        windows: list[dict],
        context: str = "",
    ) -> dict:
        content: list[dict] = [
            {
                "type": "text",
                "text": (
                    "Analyze these chronologically ordered frames per the instructions. "
                    "Each image is preceded by its timestamp in seconds from the video start; "
                    "use those timestamps for all evidence.\n"
                    "Track user-journey INTERACTIONS across the frames — taps, swipes, scrolls, "
                    "drags, button presses, finger movements and display touches — and report each "
                    "as a feature whose evidence spans the interaction (set t_start and t_end) and "
                    "whose description names the gesture, the screen/element it acts on, and the "
                    "resulting transition. The first frame may be the last frame of the previous "
                    "batch, given so you can detect motion continuing across the boundary."
                ),
            }
        ]
        if context:
            content.append({"type": "text", "text": context})
        hints = self._hints_for_range(windows, frames[0][0], frames[-1][0])
        if hints:
            content.append({"type": "text", "text": hints})
        for ts, jpeg in frames:
            b64 = base64.b64encode(jpeg).decode("ascii")
            content.append({"type": "text", "text": f"Frame at t={ts:.1f}s:"})
            content.append(
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{b64}",
                        "detail": self.vision_detail,
                    },
                }
            )

        resp = client.chat.completions.create(
            model=self.model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": content},
            ],
        )
        return extract_json(resp.choices[0].message.content or "")

    @staticmethod
    def _journey_context(partials: list[dict], last_ts: float) -> str:
        """Compact running summary fed into the next batch for cross-batch continuity."""
        feats: list[str] = []
        facts: list[str] = []
        for p in partials:
            for f in (p.get("features") or []):
                if f.get("label"):
                    feats.append(f["label"])
            for a in (p.get("atomic_facts") or []):
                if a.get("fact"):
                    facts.append(a["fact"])
        feats = list(dict.fromkeys(feats))[:20]
        facts = list(dict.fromkeys(facts))[:20]
        lines = [f"Context so far (previous batches ended at t={last_ts:.1f}s):"]
        if feats:
            lines.append("Features/interactions already seen: " + "; ".join(feats))
        if facts:
            lines.append("Facts already seen: " + "; ".join(facts))
        lines.append(
            "Continue the journey from here. Do not repeat already-listed items unless you have "
            "new evidence; do extend an ongoing interaction that started in a previous batch."
        )
        return "\n".join(lines)

    # -- Stage 5: consolidation (late fusion with the transcript) -----------
    def _consolidate(self, client, partials: list[dict], transcript: str) -> dict:
        prompt_parts = [
            "You are given several partial fact-sheet JSON analyses of consecutive segments of "
            "the same video, plus the full voiceover transcript. Merge the partials into ONE JSON "
            "object of the same shape: settle on a single vehicle_model, write a single coherent "
            "summary, union the atomic_facts (deduplicate by meaning, keep them atomic) and the "
            "features (deduplicate by meaning). Keep all evidence with its timestamps, source, "
            "quote and note. Use the transcript to add verbatim voiceover quotes as direct proof "
            "where a fact or feature is spoken about. Return ONLY the merged JSON.",
            "\nPartials:\n" + json.dumps(partials, ensure_ascii=False),
        ]
        if transcript.strip():
            prompt_parts.append("\nTranscript:\n" + transcript.strip())
        resp = client.chat.completions.create(
            model=self.model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": "".join(prompt_parts)},
            ],
        )
        return extract_json(resp.choices[0].message.content or "")

    # -- entry point --------------------------------------------------------
    async def analyze(self, video_path: Path, progress: ProgressFn | None = None) -> FactSheet:
        if not settings.openai_api_key:
            raise RuntimeError(
                "OPENAI_API_KEY is not set. Add it to backend/.env or switch PROVIDER=mock."
            )
        try:
            from openai import OpenAI
        except ImportError as e:
            raise RuntimeError(
                "openai / opencv are not installed. Run `pip install -e '.[openai]'` in backend/."
            ) from e

        def report(stage: str, message: str, current: int | None = None, total: int | None = None):
            if progress:
                progress(stage, message, current, total)

        def _run() -> dict:
            client = OpenAI(api_key=settings.openai_api_key)

            # Stage 1 + 2: audio path (graceful no-op when there is no usable audio).
            if self.use_audio:
                report("transcribe", "Transkript wird erstellt…")
            transcript_text, segments = self._transcribe(client, video_path)
            if segments:
                report("prestructure", "Voiceover wird vorstrukturiert…")
            windows = self._prestructure(client, segments)

            # Stage 3: visual path.
            report("sample", "Frames werden extrahiert…")
            frames = self._sample_frames(video_path)
            if not frames:
                raise RuntimeError("No frames could be sampled from the video.")

            # Stage 4: vision over batches, with overlapping voiceover hints.
            batches = [
                frames[i : i + self.batch_size]
                for i in range(0, len(frames), self.batch_size)
            ]
            log.info("openai_frames: %d batch(es) of <=%d frames", len(batches), self.batch_size)
            partials = []
            context = ""
            prev_tail: list[tuple[float, bytes]] = []  # last frame of prior batch (motion anchor)
            for idx, b in enumerate(batches, 1):
                report("vision", "Bilder werden analysiert", current=idx, total=len(batches))
                partials.append(self._vision_batch(client, prev_tail + b, windows, context=context))
                context = self._journey_context(partials, b[-1][0])
                prev_tail = b[-1:]

            # Stage 5: late fusion / consolidation.
            if len(partials) == 1 and not transcript_text.strip():
                return partials[0]
            report("consolidate", "Ergebnisse werden konsolidiert…")
            return self._consolidate(client, partials, transcript_text)

        data = await asyncio.to_thread(_run)
        return FactSheet.model_validate(data)
