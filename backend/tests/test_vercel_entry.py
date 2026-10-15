"""The Vercel entry point must expose the engine under /api, as the frontend expects."""

import importlib.util
from pathlib import Path

from fastapi.testclient import TestClient

ENTRY = Path(__file__).resolve().parents[2] / "api" / "index.py"


def load_entry():
    spec = importlib.util.spec_from_file_location("vercel_entry", ENTRY)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.app


def test_engine_is_mounted_under_api():
    client = TestClient(load_entry())
    assert client.get("/api/health").json() == {"ok": True}
    res = client.post("/api/recommend", json={"intent": "food", "bike": "scooter", "weather": {"condition": "clear"}, "limit": 2})
    assert res.status_code == 200
    assert len(res.json()["recommendations"]) == 2
    assert client.get("/health").status_code == 404  # only /api/* reaches the engine
