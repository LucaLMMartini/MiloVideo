from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Callable

from ..schemas import FactSheet

# Stage-progress callback: progress(stage, message, current=None, total=None).
# Providers call it as they move through their pipeline; it is optional.
ProgressFn = Callable[..., None]


class VideoAnalysisProvider(ABC):
    """Pluggable backend that turns a video file into a FactSheet.

    Implementations must not assume a fixed taxonomy. They are expected to
    discover atomic facts and recognized features directly from the video.
    """

    name: str

    @abstractmethod
    async def analyze(self, video_path: Path, progress: ProgressFn | None = None) -> FactSheet: ...
