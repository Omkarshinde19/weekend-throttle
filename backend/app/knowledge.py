"""Loads the knowledge base (routes, pitstops, bikes, rules) from app/data."""

from __future__ import annotations

import json
from collections import defaultdict
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"


def _load(name: str):
    with open(DATA_DIR / name, encoding="utf-8") as f:
        return json.load(f)


@dataclass(frozen=True)
class KnowledgeBase:
    routes: list[dict]
    routes_by_id: dict[str, dict]
    pitstops: list[dict]
    pitstops_by_route: dict[str, list[dict]]
    bikes: dict[str, dict]
    context_rules: list[dict]
    route_rules: list[dict]
    advice_rules: list[dict]


def _point_along(geometry: list[list[float]], t: float) -> tuple[float, float]:
    """(lat, lng) at fraction t of a [lng, lat] polyline's length."""
    seg = [((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2) ** 0.5 for a, b in zip(geometry, geometry[1:])]
    target, walked = sum(seg) * t, 0.0
    for (a, b), length in zip(zip(geometry, geometry[1:]), seg):
        if walked + length >= target and length > 0:
            f = (target - walked) / length
            return a[1] + (b[1] - a[1]) * f, a[0] + (b[0] - a[0]) * f
        walked += length
    return geometry[-1][1], geometry[-1][0]


def _place_pitstop(stop: dict, route: dict) -> dict:
    """Pitstops without coordinates are placed proportionally along the route's road geometry."""
    if "lat" in stop and "lng" in stop:
        return {**stop, "approx_position": False}
    t = min(1.0, max(0.0, stop["at_km"] / route["distance_km"]))
    lat, lng = _point_along(route["geometry"], t)
    return {
        **stop,
        "lat": round(lat, 5),
        "lng": round(lng, 5),
        "approx_position": True,
        "verified": stop.get("verified", False),
    }


def _check_unique_ids(*rule_sets: list[dict]) -> None:
    seen: set[str] = set()
    for rules in rule_sets:
        for r in rules:
            if r["id"] in seen:
                raise ValueError(f"Duplicate rule id {r['id']}")
            seen.add(r["id"])


@lru_cache(maxsize=1)
def load_kb() -> KnowledgeBase:
    geometry = _load("geometry.json")
    routes = [{**r, "geometry": geometry.get(r["id"], [[r["start"]["lng"], r["start"]["lat"]], [r["end"]["lng"], r["end"]["lat"]]])}
              for r in _load("routes.json")]
    routes_by_id = {r["id"]: r for r in routes}

    pitstops = []
    by_route: dict[str, list[dict]] = defaultdict(list)
    for stop in _load("pitstops.json"):
        route = routes_by_id.get(stop["route_id"])
        if route is None:
            raise ValueError(f"Pitstop {stop['id']} references unknown route {stop['route_id']}")
        placed = _place_pitstop(stop, route)
        pitstops.append(placed)
        by_route[stop["route_id"]].append(placed)
    for stops in by_route.values():
        stops.sort(key=lambda s: s["at_km"])

    context_rules = _load("rules/context_rules.json")
    route_rules = _load("rules/route_rules.json")
    advice_rules = _load("rules/advice_rules.json")
    _check_unique_ids(context_rules, route_rules, advice_rules)

    return KnowledgeBase(
        routes=routes,
        routes_by_id=routes_by_id,
        pitstops=pitstops,
        pitstops_by_route=dict(by_route),
        bikes=_load("bikes.json"),
        context_rules=context_rules,
        route_rules=route_rules,
        advice_rules=advice_rules,
    )
