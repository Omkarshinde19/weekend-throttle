from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .engine.facts import IST, hhmm
from .engine.recommender import recommend
from .engine.solar import sun_events
from .knowledge import load_kb
from .models import RecommendRequest
from .services.weather import DEFAULTS, resolve_weather

app = FastAPI(
    title="Weekend Throttle API",
    description="Rule-based ride recommender for riders and automotive photographers.",
    version="0.1.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/meta")
def meta():
    """Options for the UI controls."""
    kb = load_kb()
    return {
        "intents": [
            {"id": "photography", "label": "Photography", "hint": "Golden hour & viewpoints"},
            {"id": "thrill", "label": "Twisties", "hint": "Corners, hairpins, good tarmac"},
            {"id": "leisure", "label": "Chill cruise", "hint": "Lakes, easy roads"},
            {"id": "food", "label": "Food run", "hint": "Chai, misal, dhabas"},
            {"id": "adventure", "label": "Adventure", "hint": "Dirt, trails, remote"},
        ],
        "bikes": [{"id": k, "label": v["label"], "examples": v["examples"]} for k, v in kb.bikes.items()],
        "experience": ["beginner", "intermediate", "expert"],
        "weather_conditions": list(DEFAULTS.keys()),
        "default_start": {"lat": 18.5204, "lng": 73.8567, "name": "Pune"},
    }


@app.post("/recommend")
def post_recommend(req: RecommendRequest):
    depart = req.depart_at or datetime.now(IST)
    if depart.tzinfo is None:
        depart = depart.replace(tzinfo=IST)
    req = req.model_copy(update={"depart_at": depart})
    weather = resolve_weather(req.weather, req.start.lat, req.start.lng, depart)
    return recommend(req, weather, load_kb())


@app.get("/routes")
def list_routes():
    return load_kb().routes


@app.get("/routes/{route_id}")
def get_route(route_id: str):
    kb = load_kb()
    route = kb.routes_by_id.get(route_id)
    if route is None:
        raise HTTPException(404, f"Unknown route '{route_id}'")
    return {**route, "pitstops": kb.pitstops_by_route.get(route_id, [])}


@app.get("/pitstops")
def list_pitstops(route_id: Optional[str] = None):
    kb = load_kb()
    return kb.pitstops_by_route.get(route_id, []) if route_id else kb.pitstops


@app.get("/rules")
def list_rules():
    kb = load_kb()
    return {"context_rules": kb.context_rules, "route_rules": kb.route_rules, "advice_rules": kb.advice_rules}


@app.get("/weather")
def get_weather(lat: float = 18.5204, lng: float = 73.8567, at: Optional[datetime] = None):
    when = at or datetime.now(IST)
    if when.tzinfo is None:
        when = when.replace(tzinfo=IST)
    return resolve_weather(None, lat, lng, when)


@app.get("/sun")
def get_sun(lat: float = 18.5204, lng: float = 73.8567, on: Optional[date] = Query(None, alias="date")):
    d = on or datetime.now(IST).date()
    s = sun_events(d, lat, lng, IST)
    return {
        "date": d.isoformat(),
        "sunrise": hhmm(s["sunrise"]),
        "sunset": hhmm(s["sunset"]),
        "sunrise_azimuth": s["sunrise_azimuth"],
        "sunset_azimuth": s["sunset_azimuth"],
    }
