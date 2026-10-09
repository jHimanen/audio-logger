import json
from datetime import UTC, datetime

import pytest

from audio_logger.providers.fake import FakeTranscriptionProvider
from audio_logger.services.notes import NoteService, TranscriptionFailed
from audio_logger.storage.base import NoteNotFound
from audio_logger.storage.filesystem import FilesystemNoteRepository

AUDIO = b"\x1aE\xdf\xa3webm-bytes"


def test_create_transcribes_and_saves(
    fake_provider: FakeTranscriptionProvider, repo: FilesystemNoteRepository
) -> None:
    service = NoteService(fake_provider, repo, "fi")

    note = service.create(AUDIO, "audio/webm;codecs=opus", 4200)

    assert fake_provider.last_call == (AUDIO, "audio/webm;codecs=opus", "fi")
    assert note.language == "fi"
    assert note.duration_ms == 4200
    assert note.audio.mime_type == "audio/webm;codecs=opus"
    assert note.audio.bytes == len(AUDIO)
    assert note.transcription is not None
    assert note.transcription.provider == "fake"
    assert note.transcription.raw_text == "Tämä on testi."
    assert note.text == note.transcription.raw_text
    assert note.processing is None and note.edited_at is None
    assert repo.get(note.id) == note
    assert (repo.root / note.id / "audio.webm").read_bytes() == AUDIO


def test_returned_note_carries_final_id(
    fake_provider: FakeTranscriptionProvider,
    repo: FilesystemNoteRepository,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    frozen = datetime(2026, 10, 9, 14, 32, 5, tzinfo=UTC)
    monkeypatch.setattr("audio_logger.services.notes.utcnow", lambda: frozen)
    service = NoteService(fake_provider, repo, "fi")

    first = service.create(AUDIO, "audio/webm", 1)
    second = service.create(AUDIO, "audio/webm", 1)

    assert first.id == "2026-10-09T14-32-05Z"
    assert second.id == f"{first.id}-2"
    assert repo.get(second.id).id == second.id


def test_transcription_failure_still_saves_audio(repo: FilesystemNoteRepository) -> None:
    service = NoteService(FakeTranscriptionProvider(error="vendor down"), repo, "fi")

    with pytest.raises(TranscriptionFailed) as info:
        service.create(AUDIO, "audio/webm", 999)

    folder = repo.root / info.value.note_id
    assert (folder / "audio.webm").read_bytes() == AUDIO
    assert (folder / "note.md").read_text() == ""
    meta = json.loads((folder / "meta.json").read_text())
    assert meta["transcription"] is None
    assert meta["duration_ms"] == 999
    assert str(info.value) == "vendor down"


def test_edit_sets_text_and_edited_at(
    fake_provider: FakeTranscriptionProvider,
    repo: FilesystemNoteRepository,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = NoteService(fake_provider, repo, "fi")
    created = service.create(AUDIO, "audio/webm", 1)
    edited_at = datetime(2026, 10, 9, 15, 0, 0, tzinfo=UTC)
    monkeypatch.setattr("audio_logger.services.notes.utcnow", lambda: edited_at)

    note = service.edit(created.id, "Muokattu.")

    assert note.text == "Muokattu."
    assert note.edited_at == edited_at
    assert note.transcription is not None
    assert note.transcription.raw_text == "Tämä on testi."
    assert repo.get(created.id) == note


def test_edit_note_without_transcription(repo: FilesystemNoteRepository) -> None:
    service = NoteService(FakeTranscriptionProvider(error="down"), repo, "fi")
    with pytest.raises(TranscriptionFailed) as info:
        service.create(AUDIO, "audio/webm", 1)

    note = service.edit(info.value.note_id, "Käsin kirjoitettu.")

    assert note.transcription is None
    assert note.edited_at is not None
    assert repo.get(note.id) == note


def test_edit_missing_note_raises(
    fake_provider: FakeTranscriptionProvider, repo: FilesystemNoteRepository
) -> None:
    service = NoteService(fake_provider, repo, "fi")
    with pytest.raises(NoteNotFound):
        service.edit("nope", "x")
