import pytest

from audio_logger.providers import build_provider
from audio_logger.providers.elevenlabs import ElevenLabsProvider
from audio_logger.providers.fake import FakeTranscriptionProvider
from audio_logger.settings import Settings


def test_fake_provider_needs_no_key() -> None:
    settings = Settings(_env_file=None, stt_provider="fake")
    assert isinstance(build_provider(settings), FakeTranscriptionProvider)


def test_elevenlabs_without_key_fails_fast() -> None:
    settings = Settings(_env_file=None, stt_provider="elevenlabs", elevenlabs_api_key="")
    with pytest.raises(RuntimeError, match="ELEVENLABS_API_KEY"):
        build_provider(settings)


def test_elevenlabs_with_key() -> None:
    settings = Settings(_env_file=None, stt_provider="elevenlabs", elevenlabs_api_key="k")
    assert isinstance(build_provider(settings), ElevenLabsProvider)
