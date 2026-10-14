"""Pitstop curation and the ride timeline for a recommended route."""

from __future__ import annotations

from datetime import datetime, timedelta

from .facts import RideClock, hhmm
from .route_facts import BREAK_MIN, FOOD_TYPES, PHOTO_STAY_MIN

ALWAYS_OPEN = ("00:00", "23:59")


def _minute_of_day(hhmm_str: str) -> int:
    h, m = hhmm_str.split(":")
    return int(h) * 60 + int(m)


def is_open(stop: dict, when: datetime) -> bool:
    if (stop["opens"], stop["closes"]) == ALWAYS_OPEN:
        return True
    now = when.hour * 60 + when.minute
    o, c = _minute_of_day(stop["opens"]), _minute_of_day(stop["closes"])
    return o <= now <= c if o <= c else (now >= o or now <= c)


def _stop_score(stop: dict, facts: dict, eta: datetime) -> tuple[float, list[str]]:
    derived, intent, bike = facts["derived"], facts["ctx"]["intent"], facts["ctx"]["bike"]
    score, why = stop["rating"], [f"Rated {stop['rating']}★"]

    if not is_open(stop, eta):
        score -= 3
        why.append(f"May be closed at {hhmm(eta)} (open {stop['opens']}–{stop['closes']})")
    if derived.get("road_wet"):
        if stop["covered"]:
            score += 1.2
            why.append("Covered — shelter from the rain")
        else:
            score -= 0.8
    if derived.get("heat_stress") and stop["covered"]:
        score += 0.5
        why.append("Shade on a hot day")
    if intent == "food" and stop["type"] in FOOD_TYPES:
        score += 1.0
        why.append("Local food: " + ", ".join(stop["specialities"][:3]))
    if intent == "photography" and stop["type"] == "viewpoint_parking":
        score += 1.0
        why.append("Park right at the viewpoint")
    if bike in ("sports", "street") and stop["type"] == "biker_cafe":
        score += 0.6
        why.append("Biker-friendly cafe")
    if bike in ("sports", "cruiser") and stop["parking"] == "good":
        score += 0.3
        why.append("Safe parking for your bike")
    if derived.get("night_mode") and stop["opens"] == "00:00":
        score += 0.5
        why.append("Open 24h")
    if stop["type"] == "mechanic":
        score -= 1.5  # useful to know about, rarely a place to stop
    return score, why


def plan_ride(route: dict, fit: dict, facts: dict, clock: RideClock, stops: list[dict]) -> dict:
    approach, ride = fit["approach_min"], fit["ride_min"]
    dist = route["distance_km"]
    interval = fit["break_interval_min"]
    golden = fit.get("golden_reachable") is not None

    def minutes_at(km: float) -> float:
        return approach + ride * km / dist

    # 1. Pick stops — measured against a provisional start; ETAs are recomputed below.
    provisional_start = fit.get("_leave_dt", clock.depart)
    scored = {}
    for s in stops:
        eta = provisional_start + timedelta(minutes=minutes_at(s["at_km"]))
        scored[s["id"]] = _stop_score(s, facts, eta)

    chosen: dict[str, str] = {}  # stop id -> role

    def best(cands: list[dict]) -> dict | None:
        cands = [c for c in cands if c["id"] not in chosen]
        return max(cands, key=lambda c: scored[c["id"]][0], default=None)

    outbound = approach + ride
    target = interval
    while target < outbound:
        window = [s for s in stops if target - 0.45 * interval <= minutes_at(s["at_km"]) <= target + 0.2 * interval]
        pick = best([s for s in window if s["type"] != "mechanic"])
        if pick:
            chosen[pick["id"]] = "break"
        target += interval

    if route["max_fuel_gap_km"] >= 40 or fit["fuel_tight"]:
        fuel = next((s for s in stops if s["type"] == "fuel"), None)
        if fuel:
            chosen[fuel["id"]] = "fuel"
    if facts["ctx"]["intent"] == "photography":
        for s in stops:
            if s["type"] == "viewpoint_parking":
                chosen[s["id"]] = "viewpoint"
    if facts["ctx"]["intent"] == "food":
        for _ in range(2):
            pick = best([s for s in stops if s["type"] in FOOD_TYPES])
            if pick:
                chosen[pick["id"]] = "food"
    by_id = {s["id"]: s for s in stops}
    if not any(r in ("food", "break") and by_id[i]["at_km"] >= dist * 0.8 for i, r in chosen.items()):
        treat = best([s for s in stops if s["type"] in FOOD_TYPES and s["at_km"] >= dist * 0.8])
        if treat and scored[treat["id"]][0] >= 4:
            chosen[treat["id"]] = "destination"
    if not chosen and outbound > 40:
        pick = best([s for s in stops if s["type"] != "mechanic"])
        if pick:
            chosen[pick["id"]] = "break"

    picked = sorted((s for s in stops if s["id"] in chosen), key=lambda s: s["at_km"])

    # 2. Fix the start time. For golden hour, leave earlier to absorb breaks before the viewpoint.
    trip_start = clock.depart
    vp_km = None
    if golden:
        vp = next(v for v in route["viewpoints"] if v["name"] == fit["best_viewpoint"])
        vp_km = vp["at_km"]
        breaks_before = sum(1 for s in picked if s["at_km"] < vp_km and chosen[s["id"]] != "viewpoint")
        trip_start = max(clock.depart, fit["_leave_dt"] - timedelta(minutes=breaks_before * BREAK_MIN))

    # 3. Walk the route and build the timeline.
    events: list[dict] = [{"at": trip_start, "kind": "depart", "label": "Leave"}]
    events.append({
        "at": trip_start + timedelta(minutes=approach),
        "kind": "route_start",
        "label": f"Reach {route['start']['name']} — the good road starts",
    })

    out_stops, delay = [], 0.0
    points = [(s["at_km"], "stop", s) for s in picked]
    if vp_km is not None:
        points.append((vp_km, "viewpoint", None))
    # At the viewpoint's km: the viewpoint's own parking first, then the photo stop, then anything else.
    points.sort(key=lambda p: (p[0], 1 if p[1] == "viewpoint" else (0 if chosen[p[2]["id"]] == "viewpoint" else 2)))

    golden_arrival = None
    for km, kind, s in points:
        eta = trip_start + timedelta(minutes=minutes_at(km) + delay)
        if kind == "viewpoint":
            golden_arrival = eta
            events.append({"at": eta, "kind": "golden", "label": f"Golden hour at {fit['best_viewpoint']}"})
            delay += PHOTO_STAY_MIN
            continue
        role = chosen[s["id"]]
        _, why = _stop_score(s, facts, eta)
        out_stops.append({
            **{k: s[k] for k in ("id", "name", "type", "lat", "lng", "at_km", "rating", "covered", "specialities", "opens", "closes")},
            "role": role,
            "eta": hhmm(eta),
            "open_at_eta": is_open(s, eta),
            "why": why,
        })
        events.append({"at": eta, "kind": "pitstop", "label": f"{s['name']} ({role})", "stop_id": s["id"]})
        if role != "viewpoint":  # the viewpoint stay is already counted
            delay += BREAK_MIN

    reach_end = trip_start + timedelta(minutes=approach + ride + delay)
    events.append({"at": reach_end, "kind": "route_end", "label": f"Reach {route['end']['name']}"})
    home = reach_end + timedelta(minutes=fit["return_min"])
    events.append({"at": home, "kind": "home", "label": "Back home"})

    sun_label = None
    for when, name in ((clock.sunrise, "Sunrise"), (clock.sunset, "Sunset")):
        if trip_start <= when <= home:
            events.append({"at": when, "kind": "sun", "label": name})
            sun_label = name
    events.sort(key=lambda e: e["at"])
    events = [{"time": hhmm(e.pop("at")), **e} for e in events]

    timeline = {
        "leave_at": hhmm(trip_start),
        "back_home": hhmm(home),
        "total_hours": round((home - trip_start).total_seconds() / 3600, 1),
        "events": events,
    }
    if golden:
        window = fit["_window"]
        timeline["golden"] = {
            "viewpoint": fit["best_viewpoint"],
            "arrive": hhmm(golden_arrival),
            "window": [hhmm(window[0]), hhmm(window[1])],
            "on_time": golden_arrival <= window[1],
            "spare_min_before_leaving": round((trip_start - clock.depart).total_seconds() / 60),
        }
    if sun_label:
        timeline["sun_event_during_ride"] = sun_label
    return {"pitstops": out_stops, "timeline": timeline}
