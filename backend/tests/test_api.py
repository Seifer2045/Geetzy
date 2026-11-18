from fastapi.testclient import TestClient

from app import main, pipeline
from app.schemas import CreateGiftInput

client = TestClient(main.app)


def test_health():
    assert client.get("/health").json() == {"ok": True}


def test_user_routes_need_sign_in():
    assert client.get("/library").status_code == 401
    assert client.get("/gifts/abc", headers={"Authorization": "Token x"}).status_code == 401


def test_internal_routes_need_secret(monkeypatch):
    monkeypatch.setattr(pipeline, "sweep", lambda: {"ok": 1})
    assert client.post("/internal/sweep").status_code == 403
    assert client.post("/internal/sweep", headers={"x-internal-secret": "wrong"}).status_code == 403
    assert client.post("/internal/sweep", headers={"x-internal-secret": "internal-test"}).json() == {"ok": 1}


def test_webhook_checks_secret_and_forwards(monkeypatch):
    calls = []
    monkeypatch.setattr(pipeline, "on_render_done", lambda job, **kw: calls.append((job, kw)) or "done")
    bad = client.post("/webhooks/json2video?secret=nope&job=j1", json={"success": True})
    assert bad.status_code == 403
    ok = client.post("/webhooks/json2video?secret=webhook-test&job=j1",
                     json={"success": True, "url": "https://cdn/x.mp4", "project": "p"})
    assert ok.json() == {"result": "done"}
    assert calls == [("j1", {"success": True, "video_url": "https://cdn/x.mp4", "error": None})]


def test_webhook_test_ping_is_ignored(monkeypatch):
    monkeypatch.setattr(pipeline, "on_render_done", lambda *a, **k: (_ for _ in ()).throw(AssertionError("called")))
    assert client.post("/webhooks/json2video?secret=webhook-test&job=j", json={"test": True}).json() == {"ok": True}


def test_create_gift_contract_is_camel_case():
    body = CreateGiftInput.model_validate({
        "templateId": "TPL-BD-0142", "recipientName": "Priya", "senderName": "Rahul", "funFact": "loves chai",
        "photoPaths": ["u1/a.jpg", "u1/b.jpg", "u1/c.jpg"],
        "song": {"type": "upload", "fileName": "s.mp3", "storagePath": "u1/s.mp3", "durationSec": 180,
                 "trimStartSec": 30, "fade": True},
    })
    assert body.song.type == "upload" and body.song.storage_path == "u1/s.mp3"


def test_own_path_check():
    user = main.AuthUser(id="u1", email=None)
    assert main._check_own_path("u1/x.jpg", user) == "u1/x.jpg"
    for bad in ("u2/x.jpg", "u1/../u2/x.jpg", "x.jpg"):
        try:
            main._check_own_path(bad, user)
        except main.HTTPException as e:
            assert e.status_code == 400
        else:
            raise AssertionError(bad)
