from dataclasses import dataclass
from datetime import datetime
from typing import Protocol


@dataclass(frozen=True)
class Transcript:
    text: str
    language: str
    provider: str
    model: str
    completed_at: datetime  # tz-aware UTC


class TranscriptionError(Exception):
    """The vendor call failed; the audio could not be transcribed."""


class TranscriptionProvider(Protocol):
    name: str
    model: str

    def transcribe(self, audio: bytes, mime: str, language: str) -> Transcript: ...
