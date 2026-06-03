from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    provider: str = "openai"
    google_api_key: str = ""
    anthropic_api_key: str = ""
    openai_api_key: str = ""

    # OpenAI frame-sampling defaults — mirror the thesis instantiation:
    # one unified GPT-5 snapshot for every LLM/vision call, vision detail "high",
    # batches of at most 10 chronologically ordered frames.
    openai_model: str = "gpt-5"
    openai_vision_detail: str = "high"
    openai_batch_size: int = 10

    # Transcription always runs (for display + translation). The multimodal toggle
    # below only controls whether the transcript is USED in the analysis (hints +
    # transcript-derived facts). Whisper-1 returns segment timestamps (verbose_json).
    openai_use_audio: bool = True
    openai_transcribe_model: str = "whisper-1"

    # Target language the transcript is translated into for display (ISO-639-1 code).
    target_lang: str = "de"

    # Frame-sampling rate: sample points per second of video runtime (thesis: 1/s).
    sample_fps: float = 1.0

    max_upload_mb: int = 4096

    data_dir: Path = Path("data")

    @property
    def uploads_dir(self) -> Path:
        return self.data_dir / "uploads"

    @property
    def jobs_dir(self) -> Path:
        return self.data_dir / "jobs"

    @property
    def reports_dir(self) -> Path:
        return self.data_dir / "reports"


settings = Settings()
for d in (settings.uploads_dir, settings.jobs_dir, settings.reports_dir):
    d.mkdir(parents=True, exist_ok=True)
