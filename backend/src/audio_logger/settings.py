from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=REPO_ROOT / ".env", env_ignore_empty=True, extra="ignore"
    )

    app_locale: str = "fi"
    notes_dir: Path = REPO_ROOT / "notes"
    elevenlabs_api_key: str = ""
    stt_provider: Literal["elevenlabs", "fake"] = "elevenlabs"
    max_upload_bytes: int = 50 * 1024 * 1024
    frontend_dist: Path = REPO_ROOT / "frontend" / "dist"
