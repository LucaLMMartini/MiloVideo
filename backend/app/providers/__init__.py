from .base import VideoAnalysisProvider
from .mock import MockProvider
from ..config import settings


def get_provider(
    name: str | None = None,
    *,
    model: str | None = None,
    sample_fps: float | None = None,
    vision_detail: str | None = None,
    use_audio: bool | None = None,
) -> VideoAnalysisProvider:
    n = (name or settings.provider).lower()
    if n == "mock":
        return MockProvider()
    if n == "openai":
        from .openai_frames import OpenAIFramesProvider
        return OpenAIFramesProvider(
            model=model, sample_fps=sample_fps, vision_detail=vision_detail,
            use_audio=use_audio,
        )
    if n == "gemini":
        from .gemini import GeminiProvider
        return GeminiProvider()
    if n == "claude_frames":
        from .claude_frames import ClaudeFramesProvider
        return ClaudeFramesProvider()
    raise ValueError(f"Unknown provider: {n}")
