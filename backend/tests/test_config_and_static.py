from pathlib import Path

from fastapi.testclient import TestClient

from audio_logger.main import create_app
from audio_logger.settings import Settings


def test_config_returns_locale(client: TestClient) -> None:
    response = client.get("/api/config")
    assert response.status_code == 200
    assert response.json() == {"locale": "fi"}


def test_root_is_404_without_dist(client: TestClient) -> None:
    response = client.get("/")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_serves_dist_when_present(settings: Settings) -> None:
    settings.frontend_dist.mkdir()
    (settings.frontend_dist / "index.html").write_text("<h1>hello</h1>")
    client = TestClient(create_app(settings))

    assert client.get("/").text == "<h1>hello</h1>"
    assert client.get("/api/config").json() == {"locale": "fi"}


def test_unhandled_exception_uses_error_shape(settings: Settings) -> None:
    app = create_app(settings)

    @app.get("/boom")
    def boom() -> None:
        raise RuntimeError("boom")

    client = TestClient(app, raise_server_exceptions=False)
    response = client.get("/boom")
    assert response.status_code == 500
    assert response.json()["error"]["code"] == "server_error"


def test_relative_paths_resolve_against_repo_root() -> None:
    from audio_logger.settings import REPO_ROOT

    settings = Settings(_env_file=None, notes_dir="my-notes", frontend_dist="/abs/dist")
    assert settings.notes_dir == REPO_ROOT / "my-notes"
    assert settings.frontend_dist == Path("/abs/dist")
