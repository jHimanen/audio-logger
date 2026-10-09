import logging

import httpx

from audio_logger.models import utcnow
from audio_logger.providers.base import Transcript, TranscriptionError

log = logging.getLogger(__name__)

STT_URL = "https://api.elevenlabs.io/v1/speech-to-text"
MODEL_ID = "scribe_v2"


class ElevenLabsProvider:
    name = "elevenlabs"
    model = MODEL_ID

    def __init__(self, api_key: str, client: httpx.Client | None = None) -> None:
        self._client = client or httpx.Client(timeout=httpx.Timeout(90, connect=10))
        self._headers = {"xi-api-key": api_key}

    def transcribe(self, audio: bytes, mime: str, language: str) -> Transcript:
        try:
            response = self._client.post(
                STT_URL,
                headers=self._headers,
                files={"file": ("audio.webm", audio, mime)},
                data={
                    "model_id": MODEL_ID,
                    "language_code": language,
                    "tag_audio_events": "false",
                },
            )
            response.raise_for_status()
            text = response.json()["text"]
        except httpx.HTTPStatusError as exc:
            log.error("ElevenLabs STT failed: %s %s", exc.response.status_code, exc.response.text)
            raise TranscriptionError(f"ElevenLabs returned {exc.response.status_code}") from exc
        except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
            log.error("ElevenLabs STT failed: %r", exc)
            raise TranscriptionError(str(exc)) from exc
        return Transcript(
            text=text,
            language=language,
            provider=self.name,
            model=self.model,
            completed_at=utcnow(),
        )
