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


def _place_pitstop(stop: dict, route: dict) -> dict:
    """Pitstops without coordinates are placed proportionally between route start and end."""
    if "lat" in stop and "lng" in stop:
        return {**stop, "approx_position": False}
    t = min(1.0, max(0.0, stop["at_km"] / route["distance_km"]))
    s, e = route["start"], route["end"]
    return {
        **stop,
        "lat": round(s["lat"] + (e["lat"] - s["lat"]) * t, 5),
        "lng": round(s["lng"] + (e["lng"] - s["lng"]) * t, 5),
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
    routes = _load("routes.json")
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
