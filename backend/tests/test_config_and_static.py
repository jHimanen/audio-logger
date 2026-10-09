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
