import json
from datetime import UTC, datetime
from pathlib import Path

import pytest

from audio_logger.models import AudioInfo, Note, TranscriptionInfo, note_id
from audio_logger.storage.base import NoteNotFound
from audio_logger.storage.filesystem import FilesystemNoteRepository

AUDIO = b"\x1aE\xdf\xa3" + bytes(range(256))


def make_note(created_at: datetime, text: str = "Hei maailma.") -> Note:
    return Note(
        id=note_id(created_at),
        created_at=created_at,
        language="fi",
        duration_ms=1234,
        audio=AudioInfo(mime_type="audio/webm;codecs=opus", bytes=len(AUDIO)),
        transcription=TranscriptionInfo(
            provider="fake",
            model="fake",
            raw_text=text,
            completed_at=created_at,
        ),
        text=text,
    )


@pytest.fixture
def repo(tmp_path: Path) -> FilesystemNoteRepository:
    return FilesystemNoteRepository(tmp_path / "notes")


def test_save_writes_three_files_matching_schema(repo: FilesystemNoteRepository) -> None:
    created = datetime(2026, 10, 9, 14, 32, 5, tzinfo=UTC)
    id = repo.save(make_note(created), AUDIO)

    folder = repo.root / id
    assert id == "2026-10-09T14-32-05Z"
    assert sorted(p.name for p in folder.iterdir()) == ["audio.webm", "meta.json", "note.md"]
    assert (folder / "audio.webm").read_bytes() == AUDIO
    assert (folder / "note.md").read_text(encoding="utf-8") == "Hei maailma."

    meta = json.loads((folder / "meta.json").read_text(encoding="utf-8"))
    assert meta == {
        "id": "2026-10-09T14-32-05Z",
        "created_at": "2026-10-09T14:32:05Z",
        "language": "fi",
        "duration_ms": 1234,
        "audio": {"file": "audio.webm", "mime_type": "audio/webm;codecs=opus", "bytes": len(AUDIO)},
        "transcription": {
            "provider": "fake",
            "model": "fake",
            "raw_text": "Hei maailma.",
            "completed_at": "2026-10-09T14:32:05Z",
        },
        "processing": None,
        "edited_at": None,
    }


def test_meta_is_utf8_not_escaped(repo: FilesystemNoteRepository) -> None:
    created = datetime(2026, 10, 9, 14, 32, 5, tzinfo=UTC)
    id = repo.save(make_note(created, text="Hyvää yötä."), AUDIO)
    raw = (repo.root / id / "meta.json").read_text(encoding="utf-8")
    assert "Hyvää yötä." in raw


def test_get_round_trips(repo: FilesystemNoteRepository) -> None:
    note = make_note(datetime(2026, 10, 9, 14, 32, 5, tzinfo=UTC))
    id = repo.save(note, AUDIO)
    assert repo.get(id) == note


def test_list_is_newest_first(repo: FilesystemNoteRepository) -> None:
    older = make_note(datetime(2026, 10, 9, 14, 0, 0, tzinfo=UTC))
    newer = make_note(datetime(2026, 10, 9, 15, 0, 0, tzinfo=UTC))
    repo.save(older, AUDIO)
    repo.save(newer, AUDIO)
    assert [n.id for n in repo.list()] == [newer.id, older.id]


def test_list_without_root_is_empty(repo: FilesystemNoteRepository) -> None:
    assert repo.list() == []


def test_id_collision_gets_suffix(repo: FilesystemNoteRepository) -> None:
    note = make_note(datetime(2026, 10, 9, 14, 32, 5, tzinfo=UTC))
    assert repo.save(note, AUDIO) == note.id
    assert repo.save(note, AUDIO) == f"{note.id}-2"
    assert repo.save(note, AUDIO) == f"{note.id}-3"
    assert repo.get(f"{note.id}-2").id == f"{note.id}-2"


def test_missing_note_raises(repo: FilesystemNoteRepository) -> None:
    repo.root.mkdir()
    with pytest.raises(NoteNotFound):
        repo.get("nope")
    with pytest.raises(NoteNotFound):
        repo.get("../outside")


def test_failed_transcription_saved_as_null(repo: FilesystemNoteRepository) -> None:
    note = make_note(datetime(2026, 10, 9, 14, 32, 5, tzinfo=UTC))
    note = note.model_copy(update={"transcription": None, "text": ""})
    id = repo.save(note, AUDIO)
    meta = json.loads((repo.root / id / "meta.json").read_text(encoding="utf-8"))
    assert meta["transcription"] is None
    assert (repo.root / id / "note.md").read_text() == ""
    assert repo.get(id).transcription is None
