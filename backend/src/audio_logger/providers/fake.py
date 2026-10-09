from audio_logger.models import utcnow
from audio_logger.providers.base import Transcript, TranscriptionError


class FakeTranscriptionProvider:
    """Returns canned text without touching the network. Records the last call for tests."""

    name = "fake"
    model = "fake"

    def __init__(self, text: str = "Tämä on testi.", error: str | None = None) -> None:
        self.text = text
        self.error = error
        self.last_call: tuple[bytes, str, str] | None = None

    def transcribe(self, audio: bytes, mime: str, language: str) -> Transcript:
        self.last_call = (audio, mime, language)
        if self.error is not None:
            raise TranscriptionError(self.error)
        return Transcript(
            text=self.text,
            language=language,
            provider=self.name,
            model=self.model,
            completed_at=utcnow(),
        )
