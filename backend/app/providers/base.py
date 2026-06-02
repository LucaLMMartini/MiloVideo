from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path

from ..schemas import AnalysisResult


class VideoAnalysisProvider(ABC):
    """Pluggable backend that turns a video file into an AnalysisResult.

    Implementations must not assume a fixed taxonomy. They are expected to
    discover features, UI screens, and flows directly from the video.
    """

    name: str

    @abstractmethod
    async def analyze(self, video_path: Path) -> AnalysisResult: ...
