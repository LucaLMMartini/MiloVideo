from __future__ import annotations

from pathlib import Path

from ..schemas import AnalysisResult
from .base import VideoAnalysisProvider


class ClaudeFramesProvider(VideoAnalysisProvider):
    """Frame-sampling variant: extract frames, hand them to a vision LLM."""

    name = "claude_frames"

    async def analyze(self, video_path: Path) -> AnalysisResult:
        raise NotImplementedError(
            "ClaudeFramesProvider is a stub. Install the `claude` extras, set "
            "ANTHROPIC_API_KEY, sample frames with OpenCV, and call the Anthropic SDK "
            "with the frames + a JSON-shape prompt mirroring providers/gemini.py."
        )
