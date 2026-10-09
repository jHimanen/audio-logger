import httpx2 as httpx
import pytest

from audio_logger.providers.base import TranscriptionError
from audio_logger.providers.elevenlabs import STT_URL, ElevenLabsProvider


def provider_with(handler) -> ElevenLabsProvider:
    client = httpx.Client(transport=httpx.MockTransport(handler))
    return ElevenLabsProvider("secret-key", client=client)


def test_sends_expected_request_and_parses_text() -> None:
    seen: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["key"] = request.headers["xi-api-key"]
        seen["content_type"] = request.headers["content-type"]
        seen["body"] = request.read()
        return httpx.Response(200, json={"language_code": "fi", "text": "Hei maailma."})

    transcript = provider_with(handler).transcribe(b"\x1aE\xdf\xa3audio", "audio/webm", "fi")

    assert seen["url"] == STT_URL
    assert seen["key"] == "secret-key"
    assert str(seen["content_type"]).startswith("multipart/form-data")
    body = seen["body"]
    assert isinstance(body, bytes)
    assert b'name="model_id"\r\n\r\nscribe_v2' in body
    assert b'name="language_code"\r\n\r\nfi' in body
    assert b'name="tag_audio_events"\r\n\r\nfalse' in body
    assert b'name="file"; filename="audio.webm"\r\nContent-Type: audio/webm' in body
    assert b"\x1aE\xdf\xa3audio" in body

    assert transcript.text == "Hei maailma."
    assert transcript.language == "fi"
    assert transcript.provider == "elevenlabs"
    assert transcript.model == "scribe_v2"
    assert transcript.completed_at.tzinfo is not None


def test_http_error_status_raises() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"detail": {"status": "invalid_api_key"}})

    with pytest.raises(TranscriptionError, match="401"):
        provider_with(handler).transcribe(b"x", "audio/webm", "fi")


def test_connection_error_raises() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused")

    with pytest.raises(TranscriptionError):
        provider_with(handler).transcribe(b"x", "audio/webm", "fi")


@pytest.mark.parametrize("body", [{"language_code": "fi"}, {"text": None}, ["text"], "nope"])
def test_missing_or_invalid_text_raises(body: object) -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=body)

    with pytest.raises(TranscriptionError, match="no text field"):
        provider_with(handler).transcribe(b"x", "audio/webm", "fi")


def test_default_client_timeout() -> None:
    assert ElevenLabsProvider("k")._client.timeout == httpx.Timeout(90, connect=10)
