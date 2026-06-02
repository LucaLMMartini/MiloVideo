from __future__ import annotations

from pathlib import Path

from ..schemas import AnalysisResult
from .base import VideoAnalysisProvider

PROMPT = """You are analyzing a video to extract information about its digital features,
connectivity capabilities, and user-interface structure.

You must NOT assume any fixed taxonomy. Discover features and screens from what you see.

Return a JSON object matching this shape:
{
  "summary": "<one paragraph>",
  "features": [ { "label": "...", "kind": "digital_feature|connectivity|ui_element|other",
                  "description": "...", "evidence": [{"t_start": <sec>, "t_end": <sec|null>, "note": "..."}] } ],
  "screens":  [ { "id": "<slug>", "name": "...", "description": "...",
                  "evidence": [{"t_start": <sec>, "t_end": <sec|null>}] } ],
  "flows":    [ { "from_screen": "<screen id>", "to_screen": "<screen id>",
                  "steps": <int>, "interactions": ["...", "..."],
                  "evidence": [{"t_start": <sec>, "t_end": <sec|null>}] } ],
  "notes":    [ "..." ]
}

For "flows", count discrete interactions (taps, clicks, swipes, voice commands, hardware-button presses).
Be precise with timestamps; they will be used to jump back into the video.
"""


class GeminiProvider(VideoAnalysisProvider):
    name = "gemini"

    async def analyze(self, video_path: Path) -> AnalysisResult:
        raise NotImplementedError(
            "GeminiProvider is a stub. Install the `gemini` extras, set GOOGLE_API_KEY, "
            "and implement the call to a video-native Gemini model. The PROMPT constant "
            "in this file is the system prompt to use."
        )
