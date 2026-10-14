"""Per-route computed facts (`route.fit.*`) that rules can reason over.

These are numeric/geometric facts that are awkward to express as rules — travel times,
sun alignment, time-budget fit — so they're computed here and handed to the rule engine.
"""

from __future__ import annotations

import math
from datetime import timedelta

from .facts import RideClock, hhmm
from .solar import angle_diff

ROAD_FACTOR = 1.35          # road distance ≈ straight-line distance × this
BREAK_MIN = 15              # minutes per pitstop
PHOTO_STAY_MIN = 40         # time spent at the viewpoint for golden hour
FOOD_TYPES = {"chai_tapri", "dhaba", "restaurant", "biker_cafe"}

# Golden window relative to the sun event, and the ideal arrival time inside it (minutes).
GOLDEN = {
    "sunset": {"window": (-60, 5), "ideal": -30},
    "sunrise": {"window": (-25, 35), "ideal": -15},
}


def haversine_km(a: dict, b: dict) -> float:
    r = 6371.0
    p1, p2 = math.radians(a["lat"]), math.radians(b["lat"])
    dp, dl = p2 - p1, math.radians(b["lng"] - a["lng"])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def time_fit(total_min: float, budget_min: float) -> float:
    """1.0 when the ride uses 50–100% of the budget, tapering for very short rides,
    falling to 0 at 140% of the budget."""
    ratio = total_min / budget_min
    if ratio <= 0.5:
        return round(0.5 + ratio, 2)
    if ratio <= 1.0:
        return 1.0
    if ratio < 1.4:
        return round(1 - (ratio - 1) / 0.4, 2)
    return 0.0


def _ride_minutes(route: dict, facts: dict) -> float:
    bike, derived = facts["bike"], facts["derived"]
    minutes = route["duration_min"] * bike["pace_factor"]
    if route["surface"] == "dirt" and bike["offroad"] != "full":
        minutes *= 1.25
    if derived.get("road_wet"):
        minutes *= 1.15
    if derived.get("night_mode"):
        minutes *= 1.1
    return minutes


def _golden(route: dict, facts: dict, clock: RideClock, approach_min: float, ride_min: float) -> dict:
    target = facts["derived"].get("photo_target")
    if target not in GOLDEN or not route["viewpoints"]:
        return {"sun_alignment": 0.0, "best_viewpoint": None, "golden_reachable": None}

    sun_az = facts["derived"][f"{target}_azimuth"]
    event = clock.sunset if target == "sunset" else clock.sunrise

    best = max(
        route["viewpoints"],
        key=lambda v: (math.cos(math.radians(angle_diff(v["facing_deg"], sun_az))), -v["at_km"]),
    )
    alignment = max(0.0, math.cos(math.radians(angle_diff(best["facing_deg"], sun_az))))

    to_viewpoint = approach_min + ride_min * best["at_km"] / route["distance_km"]
    window_start = event + timedelta(minutes=GOLDEN[target]["window"][0])
    window_end = event + timedelta(minutes=GOLDEN[target]["window"][1])
    ideal_arrival = event + timedelta(minutes=GOLDEN[target]["ideal"])

    leave_by = ideal_arrival - timedelta(minutes=to_viewpoint)
    actual_leave = max(leave_by, clock.depart)
    arrival = actual_leave + timedelta(minutes=to_viewpoint)

    return {
        "sun_alignment": round(alignment, 2),
        "best_viewpoint": best["name"],
        "best_viewpoint_facing": best["facing_deg"],
        "golden_reachable": arrival <= window_end,
        "leave_by": hhmm(actual_leave),
        "_leave_dt": actual_leave,
        "_arrive_viewpoint_dt": arrival,
        "_window": (window_start, window_end),
        "minutes_to_viewpoint": round(to_viewpoint),
    }


def compute_route_fit(route: dict, facts: dict, clock: RideClock, pitstops: list[dict]) -> dict:
    """Returns the `route.fit` facts. Keys starting with `_` are internal (datetimes) and are
    stripped before the facts are shown to the user."""
    ctx, bike, derived = facts["ctx"], facts["bike"], facts["derived"]
    start = ctx["start"]

    wet_slow = 1.1 if derived.get("road_wet") else 1.0
    approach_km = haversine_km(start, route["start"]) * ROAD_FACTOR
    return_km = haversine_km(route["end"], start) * ROAD_FACTOR
    approach_min = approach_km / bike["approach_speed_kmh"] * 60 * wet_slow
    return_min = return_km / bike["approach_speed_kmh"] * 60 * wet_slow
    ride_min = _ride_minutes(route, facts)

    total_km = approach_km + route["distance_km"] + return_km
    moving_min = approach_min + ride_min + return_min
    break_interval = bike["break_interval_min"] * derived.get("break_factor", 1.0)
    breaks = int(moving_min // break_interval)

    golden = _golden(route, facts, clock, approach_min, ride_min)
    stay = PHOTO_STAY_MIN if golden.get("golden_reachable") is not None else 0
    total_min = moving_min + breaks * BREAK_MIN + stay

    trip_start = golden.get("_leave_dt", clock.depart)
    trip_end = trip_start + timedelta(minutes=total_min)
    ends_after_dark = (
        not derived.get("night_mode", False)
        and trip_start < clock.sunset
        and trip_end > clock.sunset + timedelta(minutes=15)
    )

    tags = set(route["tags"])
    loves = sorted(tags & set(bike["loves"]))
    dislikes = sorted((tags | set(route["hazards"])) & set(bike["dislikes"]))
    food_stops = [p for p in pitstops if p["type"] in FOOD_TYPES and p["rating"] >= 4.2]

    return {
        "approach_km": round(approach_km, 1),
        "approach_min": round(approach_min),
        "ride_min": round(ride_min),
        "return_min": round(return_min),
        "total_km": round(total_km),
        "total_min": round(total_min),
        "total_hours": round(total_min / 60, 1),
        "break_interval_min": round(break_interval),
        "planned_breaks": breaks,
        "time_fit": time_fit(total_min, ctx["time_budget_hours"] * 60),
        "in_season": derived["season"] in route["best_seasons"],
        "bike_love_ratio": round(min(1.0, len(loves) / 2), 2),
        "bike_love_list": loves,
        "bike_dislike_count": len(dislikes),
        "bike_dislike_list": dislikes,
        "fuel_tight": total_km > bike["range_km"] * 0.85,
        "food_stop_count": len(food_stops),
        "ends_after_dark": ends_after_dark,
        "_trip_start_dt": trip_start,
        "_trip_end_dt": trip_end,
        **golden,
    }


def public(fit: dict) -> dict:
    return {k: v for k, v in fit.items() if not k.startswith("_")}
