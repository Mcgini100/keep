import os

os.environ.setdefault("KEEP_DOWNLOAD_DIR", "/tmp/keep-test-downloads")

from fastapi.testclient import TestClient  # noqa: E402

from keep_server.links import detect_platform, normalise_url  # noqa: E402
from keep_server.main import app  # noqa: E402

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert "yt_dlp" in body


def test_detect_youtube():
    assert detect_platform("https://www.youtube.com/watch?v=dQw4w9WgXcQ") == "youtube"
    assert detect_platform("https://youtu.be/dQw4w9WgXcQ") == "youtube"
    assert detect_platform("https://youtube.com/shorts/abc123") == "youtube"
    assert detect_platform("https://music.youtube.com/watch?v=abc") == "youtube"
    assert detect_platform("https://www.youtube.com/") is None


def test_detect_instagram():
    assert detect_platform("https://www.instagram.com/reel/C1a2B3c4D5e/") == "instagram"
    assert detect_platform("https://instagram.com/p/C1a2B3c4D5e") == "instagram"
    assert detect_platform("https://www.instagram.com/someone/reel/C1a2B3/") == "instagram"
    assert detect_platform("https://www.instagram.com/someone/") is None


def test_rejects_other_sites():
    assert detect_platform("https://vimeo.com/12345") is None
    assert detect_platform("not a url") is None


def test_normalise():
    assert normalise_url("youtu.be/abc") == "https://youtu.be/abc"
    assert normalise_url("  <https://youtu.be/abc>  ") == "https://youtu.be/abc"


def test_create_job_rejects_unsupported():
    r = client.post("/api/jobs", json={"url": "https://vimeo.com/12345"})
    assert r.status_code == 422


def test_unknown_job():
    assert client.get("/api/jobs/nope").status_code == 404
