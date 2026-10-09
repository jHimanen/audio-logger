from datetime import UTC, datetime

from pydantic import BaseModel


class AudioInfo(BaseModel):
    file: str = "audio.webm"
    mime_type: str
    bytes: int


class TranscriptionInfo(BaseModel):
    provider: str
    model: str
    raw_text: str
    completed_at: datetime


class Note(BaseModel):
    """A saved note. `text` is the note.md body; everything else is meta.json."""

    id: str
    created_at: datetime
    language: str
    duration_ms: int
    audio: AudioInfo
    transcription: TranscriptionInfo | None
    processing: None = None
    edited_at: datetime | None = None
    text: str


def utcnow() -> datetime:
    return datetime.now(UTC).replace(microsecond=0)


def note_id(created_at: datetime) -> str:
    return created_at.strftime("%Y-%m-%dT%H-%M-%SZ")
