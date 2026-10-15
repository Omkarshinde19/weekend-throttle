"""The Vercel backend service must expose the engine under /api, as the frontend expects."""

from fastapi.testclient import TestClient

from vercel_app import app


def test_engine_is_mounted_under_api():
    client = TestClient(app)
    assert client.get("/api/health").json() == {"ok": True}
    res = client.post("/api/recommend", json={"intent": "food", "bike": "scooter", "weather": {"condition": "clear"}, "limit": 2})
    assert res.status_code == 200
    assert len(res.json()["recommendations"]) == 2
    assert client.get("/health").status_code == 404  # only /api/* reaches the engine
