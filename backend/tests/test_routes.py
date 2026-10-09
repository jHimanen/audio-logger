import json
from pathlib import Path

from fastapi.testclient import TestClient

from audio_logger.main import create_app
from audio_logger.providers.fake import FakeTranscriptionProvider
from audio_logger.settings import Settings
from audio_logger.storage.filesystem import FilesystemNoteRepository

AUDIO = b"\x1aE\xdf\xa3webm-bytes"


def post_note(client: TestClient, audio: bytes = AUDIO, mime: str = "audio/webm", **form):
    data = {"mime_type": mime, "duration_ms": "1500", **form}
    return client.post(
        "/api/notes", files={"audio": ("blob", audio, "application/octet-stream")}, data=data
    )


def test_create_note_returns_201_with_note_and_path(
    client: TestClient, settings: Settings, fake_provider: FakeTranscriptionProvider
) -> None:
    response = post_note(client, mime="audio/webm;codecs=opus")

    assert response.status_code == 201
    body = response.json()
    assert body["text"] == "Tämä on testi."
    assert body["language"] == "fi"
    assert body["duration_ms"] == 1500
    assert body["audio"] == {
        "file": "audio.webm",
        "mime_type": "audio/webm;codecs=opus",
        "bytes": len(AUDIO),
    }
    assert body["transcription"]["raw_text"] == "Tämä on testi."
    assert body["created_at"].endswith("Z")
    assert body["path"] == str(settings.notes_dir.resolve() / body["id"])
    assert Path(body["path"]).is_dir()
    assert fake_provider.last_call == (AUDIO, "audio/webm;codecs=opus", "fi")

    meta = json.loads((Path(body["path"]) / "meta.json").read_text())
    assert meta["audio"]["mime_type"] == "audio/webm;codecs=opus"


def test_mime_not_allowed(client: TestClient, settings: Settings) -> None:
    response = post_note(client, mime="audio/mpeg")
    assert response.status_code == 415
    assert response.json()["error"] == {
        "code": "invalid_mime",
        "message": "Unsupported audio type 'audio/mpeg'",
        "mime_type": "audio/mpeg",
    }
    assert not settings.notes_dir.exists()


def test_too_large(settings: Settings, fake_provider: FakeTranscriptionProvider) -> None:
    settings.max_upload_bytes = 10
    client = TestClient(create_app(settings, provider=fake_provider))
    response = post_note(client, audio=b"x" * 11)
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "too_large"
    assert response.json()["error"]["max_bytes"] == 10
    assert post_note(client, audio=b"x" * 10).status_code == 201


def test_empty_audio(client: TestClient) -> None:
    response = post_note(client, audio=b"")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "empty_audio"


def test_missing_duration_is_validation_error(client: TestClient) -> None:
    response = client.post(
        "/api/notes", files={"audio": ("blob", AUDIO)}, data={"mime_type": "audio/webm"}
    )
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert error["detail"][0]["loc"] == ["body", "duration_ms"]


def test_audio_as_text_field_is_validation_error(client: TestClient) -> None:
    response = client.post(
        "/api/notes", data={"audio": "abc", "mime_type": "audio/webm", "duration_ms": "1"}
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_negative_duration_is_validation_error(client: TestClient) -> None:
    assert post_note(client, duration_ms="-1").status_code == 422


def test_transcription_failure_returns_502_and_keeps_audio(
    settings: Settings, repo: FilesystemNoteRepository
) -> None:
    provider = FakeTranscriptionProvider(error="boom")
    client = TestClient(create_app(settings, provider=provider, repository=repo))

    response = post_note(client)

    assert response.status_code == 502
    error = response.json()["error"]
    assert error["code"] == "transcription_failed"
    assert error["path"] == str(settings.notes_dir.resolve() / error["note_id"])
    folder = settings.notes_dir / error["note_id"]
    assert (folder / "audio.webm").read_bytes() == AUDIO
    assert json.loads((folder / "meta.json").read_text())["transcription"] is None


def test_list_notes_empty(client: TestClient) -> None:
    response = client.get("/api/notes")
    assert response.status_code == 200
    assert response.json() == []


def test_list_notes_newest_first(client: TestClient, settings: Settings) -> None:
    first = post_note(client).json()
    second = post_note(client).json()

    notes = client.get("/api/notes").json()

    assert [n["id"] for n in notes] == sorted([first["id"], second["id"]], reverse=True)
    for note in notes:
        assert note["text"] == "Tämä on testi."
        assert note["path"] == str(settings.notes_dir.resolve() / note["id"])
        assert note["transcription"]["provider"] == "fake"


def test_list_includes_failed_transcription(
    settings: Settings, repo: FilesystemNoteRepository
) -> None:
    client = TestClient(
        create_app(settings, provider=FakeTranscriptionProvider(error="boom"), repository=repo)
    )
    note_id = post_note(client).json()["error"]["note_id"]

    notes = client.get("/api/notes").json()

    assert [n["id"] for n in notes] == [note_id]
    assert notes[0]["transcription"] is None
    assert notes[0]["text"] == ""


def test_get_note_round_trips(client: TestClient) -> None:
    created = post_note(client).json()
    response = client.get(f"/api/notes/{created['id']}")
    assert response.status_code == 200
    assert response.json() == created


def test_get_note_not_found(client: TestClient) -> None:
    response = client.get("/api/notes/nope")
    assert response.status_code == 404
    assert response.json()["error"] == {
        "code": "not_found",
        "message": "No note 'nope'",
        "note_id": "nope",
    }


def test_get_note_rejects_traversal(client: TestClient) -> None:
    post_note(client)
    # httpx normalises a literal "..", so only the encoded form reaches the route.
    response = client.get("/api/notes/%2e%2e")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_get_audio(client: TestClient) -> None:
    note_id = post_note(client, mime="audio/webm;codecs=opus").json()["id"]

    response = client.get(f"/api/notes/{note_id}/audio")

    assert response.status_code == 200
    assert response.content == AUDIO
    assert response.headers["content-type"] == "audio/webm;codecs=opus"


def test_get_audio_range(client: TestClient) -> None:
    note_id = post_note(client).json()["id"]

    response = client.get(f"/api/notes/{note_id}/audio", headers={"Range": "bytes=0-3"})

    assert response.status_code == 206
    assert response.headers["content-range"] == f"bytes 0-3/{len(AUDIO)}"
    assert response.content == AUDIO[:4]


def test_get_audio_not_found(client: TestClient) -> None:
    response = client.get("/api/notes/nope/audio")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_get_audio_missing_file(client: TestClient, settings: Settings) -> None:
    note_id = post_note(client).json()["id"]
    (settings.notes_dir / note_id / "audio.webm").unlink()

    response = client.get(f"/api/notes/{note_id}/audio")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"
