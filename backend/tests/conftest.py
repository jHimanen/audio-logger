from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from audio_logger.main import create_app
from audio_logger.providers.fake import FakeTranscriptionProvider
from audio_logger.settings import Settings
from audio_logger.storage.filesystem import FilesystemNoteRepository


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(
        _env_file=None,
        notes_dir=tmp_path / "notes",
        stt_provider="fake",
        frontend_dist=tmp_path / "dist",
    )


@pytest.fixture
def fake_provider() -> FakeTranscriptionProvider:
    return FakeTranscriptionProvider()


@pytest.fixture
def repo(settings: Settings) -> FilesystemNoteRepository:
    return FilesystemNoteRepository(settings.notes_dir)


@pytest.fixture
def client(
    settings: Settings, fake_provider: FakeTranscriptionProvider, repo: FilesystemNoteRepository
) -> TestClient:
    return TestClient(create_app(settings, provider=fake_provider, repository=repo))
