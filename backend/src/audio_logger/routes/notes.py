from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, File, Form, Request, Response, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from audio_logger.errors import AppError
from audio_logger.models import Note
from audio_logger.services.notes import TranscriptionFailed
from audio_logger.storage.base import NoteNotFound

router = APIRouter(prefix="/api")

ALLOWED_MIME_TYPES = {"audio/webm"}


class NoteUpdate(BaseModel):
    text: str


def _notes_dir(request: Request) -> Path:
    return request.app.state.settings.notes_dir.resolve()


def _note_json(note: Note, notes_dir: Path) -> dict[str, Any]:
    return note.model_dump(mode="json") | {"path": str(notes_dir / note.id)}


def _not_found(id: str) -> AppError:
    return AppError(404, "not_found", f"No note {id!r}", note_id=id)


def _load(request: Request, id: str) -> Note:
    try:
        return request.app.state.service.repository.get(id)
    except NoteNotFound as exc:
        raise _not_found(id) from exc


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

    notes_dir = _notes_dir(request)
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
    return _note_json(note, notes_dir)


@router.get("/notes")
def list_notes(request: Request) -> list[dict[str, Any]]:
    notes_dir = _notes_dir(request)
    return [_note_json(note, notes_dir) for note in request.app.state.service.repository.list()]


@router.get("/notes/{id}")
def get_note(request: Request, id: str) -> dict[str, Any]:
    return _note_json(_load(request, id), _notes_dir(request))


@router.put("/notes/{id}")
def update_note(request: Request, id: str, body: NoteUpdate) -> dict[str, Any]:
    try:
        note = request.app.state.service.edit(id, body.text)
    except NoteNotFound as exc:
        raise _not_found(id) from exc
    return _note_json(note, _notes_dir(request))


@router.delete("/notes/{id}", status_code=204, response_class=Response)
def delete_note(request: Request, id: str) -> None:
    try:
        request.app.state.service.repository.delete(id)
    except NoteNotFound as exc:
        raise _not_found(id) from exc


@router.get("/notes/{id}/audio")
def get_note_audio(request: Request, id: str) -> FileResponse:
    note = _load(request, id)
    folder = _notes_dir(request) / note.id
    file = folder / note.audio.file
    # FileResponse raises (500) on a missing file; report it as a missing note instead.
    # audio.file comes from meta.json, so keep it inside the note folder.
    if file.resolve().parent != folder or not file.is_file():
        raise _not_found(id)
    return FileResponse(file, media_type=note.audio.mime_type)
