from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_meta():
    data = client.get("/meta").json()
    assert {i["id"] for i in data["intents"]} == {"photography", "thrill", "leisure", "food", "adventure"}
    assert len(data["bikes"]) == 5


def test_recommend_with_simulated_weather():
    body = {
        "intent": "photography",
        "bike": "cruiser",
        "depart_at": "2026-10-17T15:30:00+05:30",
        "weather": {"condition": "drizzle"},
        "limit": 3,
    }
    res = client.post("/recommend", json=body)
    assert res.status_code == 200
    data = res.json()
    assert data["context"]["ctx"]["weather"]["source"] == "simulated"
    assert len(data["recommendations"]) == 3
    rec = data["recommendations"][0]
    assert {"route", "score", "reasons", "warnings", "pitstops", "timeline", "stats"} <= rec.keys()
    assert not any(k.startswith("_") for k in rec["stats"])


def test_recommend_validates_input():
    assert client.post("/recommend", json={"intent": "racing", "bike": "sports"}).status_code == 422


def test_route_lookup():
    assert client.get("/routes/tamhini_ghat").json()["pitstops"]
    assert client.get("/routes/nope").status_code == 404


def test_sun():
    data = client.get("/sun", params={"date": "2026-10-15"}).json()
    assert data["sunset"].startswith("18:")


def test_rules():
    data = client.get("/rules").json()
    assert data["context_rules"] and data["route_rules"] and data["advice_rules"]
