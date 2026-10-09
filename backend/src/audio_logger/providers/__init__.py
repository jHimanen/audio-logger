from audio_logger.providers.base import TranscriptionProvider
from audio_logger.providers.elevenlabs import ElevenLabsProvider
from audio_logger.providers.fake import FakeTranscriptionProvider
from audio_logger.settings import Settings


def build_provider(settings: Settings) -> TranscriptionProvider:
    if settings.stt_provider == "fake":
        return FakeTranscriptionProvider()
    if not settings.elevenlabs_api_key:
        raise RuntimeError("ELEVENLABS_API_KEY is not set (or use STT_PROVIDER=fake)")
    return ElevenLabsProvider(settings.elevenlabs_api_key)
