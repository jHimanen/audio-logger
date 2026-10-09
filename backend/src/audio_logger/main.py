from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from audio_logger.errors import register_error_handlers
from audio_logger.providers import build_provider
from audio_logger.providers.base import TranscriptionProvider
from audio_logger.routes import config, notes
from audio_logger.services.notes import NoteService
from audio_logger.settings import Settings
from audio_logger.storage.base import NoteRepository
from audio_logger.storage.filesystem import FilesystemNoteRepository


def create_app(
    settings: Settings | None = None,
    *,
    provider: TranscriptionProvider | None = None,
    repository: NoteRepository | None = None,
) -> FastAPI:
    """App factory. Run with `uvicorn audio_logger.main:create_app --factory`."""
    settings = settings or Settings()
    app = FastAPI(title="audio-logger")
    app.state.settings = settings
    app.state.service = NoteService(
        provider or build_provider(settings),
        repository or FilesystemNoteRepository(settings.notes_dir),
        settings.app_locale,
    )

    register_error_handlers(app)
    app.include_router(config.router)
    app.include_router(notes.router)

    if settings.frontend_dist.is_dir():
        app.mount("/", StaticFiles(directory=settings.frontend_dist, html=True))
    return app
