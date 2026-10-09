from typing import Annotated, Any

from fastapi import APIRouter, File, Form, Request, UploadFile

from audio_logger.errors import AppError
from audio_logger.services.notes import TranscriptionFailed

router = APIRouter(prefix="/api")

ALLOWED_MIME_TYPES = {"audio/webm"}


@router.post("/notes", status_code=201)
def create_note(
    request: Request,
    audio: Annotated[UploadFile, File()],
    mime_type: Annotated[str, Form()],
    duration_ms: Annotated[int, Form(ge=0)],
) -> dict[str, Any]:
    settings = request.app.state.settings
    base_type = mime_type.split(";", 1)[0].strip().lower()
    if base_type not in ALLOWED_MIME_TYPES:
        raise AppError(
            415, "invalid_mime", f"Unsupported audio type {mime_type!r}", mime_type=mime_type
        )

    data = audio.file.read(settings.max_upload_bytes + 1)
    if len(data) > settings.max_upload_bytes:
        raise AppError(413, "too_large", "Audio is too large", max_bytes=settings.max_upload_bytes)
    if not data:
        raise AppError(400, "empty_audio", "Audio is empty")

    notes_dir = settings.notes_dir.resolve()
    try:
        note = request.app.state.service.create(data, mime_type, duration_ms)
    except TranscriptionFailed as exc:
        raise AppError(
            502,
            "transcription_failed",
            f"Transcription failed; audio saved as {exc.note_id}",
            note_id=exc.note_id,
            path=str(notes_dir / exc.note_id),
        ) from exc
    return note.model_dump(mode="json") | {"path": str(notes_dir / note.id)}
