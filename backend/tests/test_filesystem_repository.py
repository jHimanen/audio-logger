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
    for escaping in ("..", "../outside", "/etc", ""):
        with pytest.raises(NoteNotFound):
            repo.get(escaping)


def test_failed_transcription_saved_as_null(repo: FilesystemNoteRepository) -> None:
    note = make_note(datetime(2026, 10, 9, 14, 32, 5, tzinfo=UTC))
    note = note.model_copy(update={"transcription": None, "text": ""})
    id = repo.save(note, AUDIO)
    meta = json.loads((repo.root / id / "meta.json").read_text(encoding="utf-8"))
    assert meta["transcription"] is None
    assert (repo.root / id / "note.md").read_text() == ""
    assert repo.get(id).transcription is None


def test_update_rewrites_text_and_meta_not_audio(repo: FilesystemNoteRepository) -> None:
    created = datetime(2026, 10, 9, 14, 32, 5, tzinfo=UTC)
    id = repo.save(make_note(created), AUDIO)
    edited = datetime(2026, 10, 9, 15, 0, 0, tzinfo=UTC)

    repo.update(repo.get(id).model_copy(update={"text": "Muokattu.", "edited_at": edited}))

    folder = repo.root / id
    assert (folder / "note.md").read_text(encoding="utf-8") == "Muokattu."
    meta = json.loads((folder / "meta.json").read_text(encoding="utf-8"))
    assert meta["edited_at"] == "2026-10-09T15:00:00Z"
    assert meta["transcription"]["raw_text"] == "Hei maailma."
    assert "text" not in meta
    assert (folder / "audio.webm").read_bytes() == AUDIO
    assert repo.get(id).text == "Muokattu."


def test_update_missing_note_raises(repo: FilesystemNoteRepository) -> None:
    repo.root.mkdir()
    with pytest.raises(NoteNotFound):
        repo.update(make_note(datetime(2026, 10, 9, 14, 32, 5, tzinfo=UTC)))


def test_delete_removes_folder(repo: FilesystemNoteRepository) -> None:
    keep = repo.save(make_note(datetime(2026, 10, 9, 14, 0, 0, tzinfo=UTC)), AUDIO)
    gone = repo.save(make_note(datetime(2026, 10, 9, 15, 0, 0, tzinfo=UTC)), AUDIO)

    repo.delete(gone)

    assert not (repo.root / gone).exists()
    assert [n.id for n in repo.list()] == [keep]


def test_delete_missing_or_escaping_raises(repo: FilesystemNoteRepository) -> None:
    repo.root.mkdir()
    for id in ("nope", "..", ""):
        with pytest.raises(NoteNotFound):
            repo.delete(id)
    assert repo.root.is_dir()


def test_delete_symlink_outside_root_raises(repo: FilesystemNoteRepository, tmp_path: Path) -> None:
    target = tmp_path / "outside"
    target.mkdir()
    (target / "meta.json").write_text("{}")
    repo.root.mkdir()
    (repo.root / "link").symlink_to(target)

    with pytest.raises(NoteNotFound):
        repo.delete("link")

    assert (target / "meta.json").read_text() == "{}"
