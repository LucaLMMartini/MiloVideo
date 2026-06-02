from __future__ import annotations

import asyncio
import json
import logging
import re
from pathlib import Path

from ..config import settings
from ..schemas import AnalysisResult
from .base import VideoAnalysisProvider

log = logging.getLogger(__name__)


SYSTEM_PROMPT = """You analyze a video to extract information about its digital features,
connectivity capabilities, and user-interface structure.

You must NOT assume any fixed taxonomy. Discover features and screens from what you see.

Return ONLY a JSON object — no prose, no markdown fences — matching this shape:

{
  "summary": "<one paragraph>",
  "features": [
    {
      "label": "<short name you chose>",
      "kind": "digital_feature" | "connectivity" | "ui_element" | "other",
      "description": "<one or two sentences>",
      "evidence": [{"t_start": <sec>, "t_end": <sec|null>, "note": "<what is shown>"}]
    }
  ],
  "screens": [
    {
      "id": "<slug>",
      "name": "<human name>",
      "description": "<purpose of this screen>",
      "evidence": [{"t_start": <sec>, "t_end": <sec|null>}]
    }
  ],
  "flows": [
    {
      "from_screen": "<screen id>",
      "to_screen":   "<screen id>",
      "steps": <int>,
      "interactions": ["<tap …>", "<swipe …>", "<voice command …>", "<press …>"],
      "evidence": [{"t_start": <sec>, "t_end": <sec|null>}]
    }
  ],
  "notes": ["<anything important that does not fit above>"]
}

Counting rules for "steps":
  - One step per discrete user interaction: tap/click, swipe, scroll, voice command,
    hardware-button press, gesture.
  - Do not count automatic transitions (animations, system-driven dialogs).
  - If you are uncertain about the exact count, give your best estimate and add
    a "notes" entry explaining the uncertainty.

Timestamp rules:
  - All timestamps are seconds from the start of the video, as numbers (e.g. 12.5).
  - Be precise; timestamps are used to jump back into the video.
"""


def _extract_json(text: str) -> dict:
    """Best-effort JSON extraction — handles models that wrap in ```json fences."""
    text = text.strip()
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if m:
        text = m.group(1)
    else:
        first = text.find("{")
        last = text.rfind("}")
        if first != -1 and last > first:
            text = text[first : last + 1]
    return json.loads(text)


class GeminiProvider(VideoAnalysisProvider):
    name = "gemini"
    model_id = "gemini-2.0-flash-exp"

    async def analyze(self, video_path: Path) -> AnalysisResult:
        if not settings.google_api_key:
            raise RuntimeError(
                "GOOGLE_API_KEY is not set. Add it to backend/.env or switch PROVIDER=mock."
            )

        try:
            from google import genai
            from google.genai import types
        except ImportError as e:
            raise RuntimeError(
                "google-genai is not installed. Run `pip install -e '.[gemini]'` in backend/."
            ) from e

        client = genai.Client(api_key=settings.google_api_key)

        def _run() -> str:
            log.info("gemini: uploading %s", video_path)
            uploaded = client.files.upload(file=str(video_path))
            while uploaded.state and uploaded.state.name == "PROCESSING":
                log.info("gemini: waiting for file processing")
                import time
                time.sleep(2)
                uploaded = client.files.get(name=uploaded.name)

            if uploaded.state and uploaded.state.name == "FAILED":
                raise RuntimeError(f"Gemini file upload failed: {uploaded.state}")

            log.info("gemini: generating analysis")
            response = client.models.generate_content(
                model=self.model_id,
                contents=[uploaded, "Analyze this video per the instructions."],
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    response_mime_type="application/json",
                    temperature=0.2,
                ),
            )
            return response.text or ""

        raw = await asyncio.to_thread(_run)
        data = _extract_json(raw)
        return AnalysisResult.model_validate(data)
