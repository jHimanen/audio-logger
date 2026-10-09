from typing import Protocol

from audio_logger.models import Note


class NoteNotFound(LookupError):
    pass


class NoteRepository(Protocol):
    def save(self, note: Note, audio: bytes) -> str:
        """Persist the note and its audio. Returns the final id (may differ on collision)."""
        ...

    def get(self, id: str) -> Note: ...

    def list(self) -> list[Note]:
        """All notes, newest first."""
        ...
