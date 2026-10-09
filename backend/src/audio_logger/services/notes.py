from audio_logger.models import AudioInfo, Note, TranscriptionInfo, note_id, utcnow
from audio_logger.providers.base import TranscriptionError, TranscriptionProvider
from audio_logger.storage.base import NoteRepository


class TranscriptionFailed(Exception):
    """Transcription failed but the audio was saved under `note_id`."""

    def __init__(self, note_id: str, cause: TranscriptionError) -> None:
        super().__init__(str(cause))
        self.note_id = note_id


class NoteService:
    def __init__(
        self, provider: TranscriptionProvider, repository: NoteRepository, language: str
    ) -> None:
        self.provider = provider
        self.repository = repository
        self.language = language

    def create(self, audio: bytes, mime_type: str, duration_ms: int) -> Note:
        created_at = utcnow()
        base = {
            "id": note_id(created_at),
            "created_at": created_at,
            "language": self.language,
            "duration_ms": duration_ms,
            "audio": AudioInfo(mime_type=mime_type, bytes=len(audio)),
        }
        try:
            transcript = self.provider.transcribe(audio, mime_type, self.language)
        except TranscriptionError as exc:
            saved_id = self.repository.save(Note(**base, transcription=None, text=""), audio)
            raise TranscriptionFailed(saved_id, exc) from exc

        note = Note(
            **base,
            transcription=TranscriptionInfo(
                provider=transcript.provider,
                model=transcript.model,
                raw_text=transcript.text,
                completed_at=transcript.completed_at,
            ),
            text=transcript.text,
        )
        saved_id = self.repository.save(note, audio)
        return note.model_copy(update={"id": saved_id})

    def edit(self, id: str, text: str) -> Note:
        note = self.repository.get(id)
        note = note.model_copy(update={"text": text, "edited_at": utcnow()})
        self.repository.update(note)
        return note
