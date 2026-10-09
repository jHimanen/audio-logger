from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from audio_logger.errors import register_error_handlers
from audio_logger.providers.base import TranscriptionProvider
from audio_logger.routes import config
from audio_logger.settings import Settings
from audio_logger.storage.base import NoteRepository


def create_app(
    settings: Settings | None = None,
    *,
    provider: TranscriptionProvider | None = None,
    repository: NoteRepository | None = None,
) -> FastAPI:
    settings = settings or Settings()
    app = FastAPI(title="audio-logger")
    app.state.settings = settings
    app.state.provider = provider
    app.state.repository = repository

    register_error_handlers(app)
    app.include_router(config.router)

    if settings.frontend_dist.is_dir():
        app.mount("/", StaticFiles(directory=settings.frontend_dist, html=True))
    return app


app = create_app()
