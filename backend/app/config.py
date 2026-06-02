from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    provider: str = "mock"
    google_api_key: str = ""
    anthropic_api_key: str = ""
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
