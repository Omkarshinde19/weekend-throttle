from datetime import date, datetime

import pytest

from app.engine.conditions import evaluate, render
from app.engine.facts import IST
from app.engine.inference import forward_chain
from app.engine.recommender import recommend
from app.engine.solar import angle_diff, sun_events
from app.knowledge import load_kb
from app.models import RecommendRequest, WeatherInput
from app.services.weather import condition_from_code, from_override

KB = load_kb()


def run(weather="clear", **kw):
    req = RecommendRequest(**kw)
    return recommend(req, from_override(WeatherInput(condition=weather)), KB)


def ids(out):
    return [r["route"]["id"] for r in out["recommendations"]]


def excluded(out):
    return {e["route_id"]: [x["rule_id"] for x in e["reasons"]] for e in out["excluded"]}


# --- solar -----------------------------------------------------------------------------------

def test_pune_sunset_mid_october():
    s = sun_events(date(2026, 10, 15), 18.5204, 73.8567, IST)
    assert "18:00" <= s["sunset"].strftime("%H:%M") <= "18:20"
    assert "06:15" <= s["sunrise"].strftime("%H:%M") <= "06:35"
    assert 255 <= s["sunset_azimuth"] <= 265


def test_angle_diff_wraps():
    assert angle_diff(350, 10) == 20
    assert angle_diff(90, 270) == 180


# --- condition DSL ---------------------------------------------------------------------------

def test_conditions():
    facts = {"a": {"n": 5, "tags": ["x", "y"], "s": "rain", "cap": 4}}
    assert evaluate({"fact": "a.n", "op": "between", "value": [1, 5]}, facts)
    assert evaluate({"fact": "a.tags", "op": "contains_any", "value": ["z", "y"]}, facts)
    assert evaluate({"fact": "a.n", "op": "gt", "value_fact": "a.cap"}, facts)
    assert evaluate({"not": {"fact": "a.missing", "op": "exists"}}, facts)
    assert not evaluate({"fact": "a.missing", "op": "eq", "value": None}, facts)
    assert evaluate({"all": [{"fact": "a.s", "op": "in", "value": ["rain"]}, {"any": [{"fact": "a.n", "op": "lt", "value": 1}, {"fact": "a.n", "op": "eq", "value": 5}]}]}, facts)
    assert render("{a.n} km, {a.tags}, {a.nope}", facts) == "5 km, x, y, ?"


def test_forward_chaining_derives_chain_of_facts():
    facts = {"ctx": {"weather": {"condition": "heavy_rain", "precip_mm": 12}, "experience": "intermediate"},
             "derived": {"season": "monsoon", "break_factor": 1.0}}
    trace = forward_chain(facts, KB.context_rules)
    fired = [t["rule_id"] for t in trace]
    # rain → wet road → offroad unsafe → (with monsoon) landslide risk
    assert fired.index("C_RAIN_HEAVY") < fired.index("C_ROAD_WET") < fired.index("C_OFFROAD_UNSAFE")
    assert facts["derived"]["offroad_unsafe"] is True
    assert facts["derived"]["landslide_risk"] == "high"
    assert facts["derived"]["max_difficulty"] == 3  # 4 × 0.75 in heavy rain
    assert len(fired) == len(set(fired))  # refraction: each rule fires once


# --- scenarios -------------------------------------------------------------------------------

def test_heavy_monsoon_rain_filters_dirt_and_landslide_ghats():
    out = run("heavy_rain", intent="adventure", bike="adventure", depart_at="2026-07-18T08:00:00+05:30", time_budget_hours=8)
    ex = excluded(out)
    assert "F_WET_UNPAVED" in ex["rajmachi_trail"]
    assert "F_WET_UNPAVED" in ex["shirota_trail"]
    assert "F_LANDSLIDE" in ex["tamhini_ghat"]
    for r in out["recommendations"]:
        assert r["route"]["surface"] == "paved"


def test_dry_adventure_prefers_offroad():
    out = run(intent="adventure", bike="adventure", experience="expert", depart_at="2026-01-10T07:00:00+05:30", time_budget_hours=6)
    assert set(ids(out)[:2]) == {"rajmachi_trail", "shirota_trail"}


def test_golden_hour_photography():
    out = run(intent="photography", bike="sports", depart_at="2026-10-17T15:00:00+05:30", time_budget_hours=5)
    assert out["context"]["derived"]["photo_target"] == "sunset"
    top = out["recommendations"][0]
    assert top["stats"]["sun_alignment"] >= 0.7
    golden = top["timeline"]["golden"]
    assert golden["on_time"]
    assert golden["window"][0] <= golden["arrive"] <= golden["window"][1]


def test_sunrise_shoot_is_not_night_mode():
    out = run(intent="photography", bike="street", depart_at="2026-01-10T05:15:00+05:30", time_budget_hours=5)
    d = out["context"]["derived"]
    assert d["photo_target"] == "sunrise"
    assert d.get("predawn") is True and not d.get("night_mode")
    assert "F_NIGHT_UNSAFE" not in {r for rs in excluded(out).values() for r in rs}


def test_night_ride_only_night_safe_routes():
    out = run(intent="leisure", bike="cruiser", depart_at="2026-11-08T20:00:00+05:30", time_budget_hours=4)
    assert out["recommendations"]
    assert all(r["route"]["night_safe"] for r in out["recommendations"])


def test_beginner_and_scooter_constraints():
    out = run(intent="leisure", bike="scooter", experience="beginner", pillion=True,
              depart_at="2026-12-20T09:00:00+05:30", time_budget_hours=4)
    ex = excluded(out)
    assert "F_SKILL_CAP" in ex["sinhagad_ghat"]
    assert "F_BIKE_NO_OFFROAD" in ex["rajmachi_trail"]
    assert all(r["route"]["difficulty"] <= 3 for r in out["recommendations"])
    assert all(r["stats"]["time_fit"] > 0 for r in out["recommendations"])


def test_thrill_ranks_twisty_roads_above_highway():
    out = run(intent="thrill", bike="sports", experience="expert", depart_at="2026-11-10T07:00:00+05:30", time_budget_hours=8, limit=20)
    order = ids(out)
    assert order.index("lavasa_road") < order.index("khambatki_highway")


def test_rain_prefers_covered_pitstops():
    kw = dict(intent="food", bike="street", depart_at="2026-11-10T08:00:00+05:30", time_budget_hours=5, limit=20)
    dry, wet = run(**kw), run("rain", **kw)
    covered = lambda out: {r["route"]["id"]: sum(p["covered"] for p in r["pitstops"]) for r in out["recommendations"]}
    dry_c, wet_c = covered(dry), covered(wet)
    shared = dry_c.keys() & wet_c.keys()
    assert shared
    assert all(wet_c[k] >= dry_c[k] for k in shared)
    assert any("Covered" in w for r in wet["recommendations"] for p in r["pitstops"] for w in p["why"])


@pytest.mark.parametrize("intent", ["photography", "thrill", "leisure", "food", "adventure"])
@pytest.mark.parametrize("bike", ["cruiser", "sports", "adventure", "street", "scooter"])
def test_every_combination_produces_sane_output(intent, bike):
    out = run(intent=intent, bike=bike, depart_at="2026-10-17T09:00:00+05:30")
    assert len(out["recommendations"]) + len(out["excluded"]) >= min(len(KB.routes), 5)
    for r in out["recommendations"]:
        assert 0 <= r["score"] <= 100
        times = [e["time"] for e in r["timeline"]["events"]]
        assert times == sorted(times)
        etas = [p["eta"] for p in r["pitstops"]]
        assert etas == sorted(etas)
        assert "?" not in " ".join(x["text"] for x in r["reasons"] + r["warnings"])
    scores = [r["score"] for r in out["recommendations"]]
    assert scores == sorted(scores, reverse=True)


# --- knowledge base integrity ---------------------------------------------------------------

def test_knowledge_base_is_consistent():
    for route in KB.routes:
        for vp in route["viewpoints"]:
            assert 0 <= vp["at_km"] <= route["distance_km"], (route["id"], vp["name"])
            assert 0 <= vp["facing_deg"] < 360
    for stop in KB.pitstops:
        assert 0 <= stop["at_km"] <= KB.routes_by_id[stop["route_id"]]["distance_km"], stop["id"]
    for route in KB.routes:
        assert len(route["geometry"]) >= 2, route["id"]
        lng, lat = route["geometry"][0]
        assert abs(lat - route["start"]["lat"]) < 0.05 and abs(lng - route["start"]["lng"]) < 0.05, route["id"]
    for rule in KB.route_rules:
        assert rule["type"] in ("filter", "score", "warn")


def test_weather_code_mapping():
    assert condition_from_code(0, 0) == "clear"
    assert condition_from_code(45, 0) == "fog"
    assert condition_from_code(63, 3) == "rain"
    assert condition_from_code(61, 9) == "heavy_rain"
    assert condition_from_code(95, 0) == "thunderstorm"
