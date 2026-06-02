from .base import VideoAnalysisProvider
from .mock import MockProvider
from ..config import settings


def get_provider(name: str | None = None) -> VideoAnalysisProvider:
    n = (name or settings.provider).lower()
    if n == "mock":
        return MockProvider()
    if n == "gemini":
        from .gemini import GeminiProvider
        return GeminiProvider()
    if n == "claude_frames":
        from .claude_frames import ClaudeFramesProvider
        return ClaudeFramesProvider()
    raise ValueError(f"Unknown provider: {n}")
