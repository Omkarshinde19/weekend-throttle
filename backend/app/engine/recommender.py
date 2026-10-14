"""Top-level pipeline: facts → forward chaining → per-route rules → rank → plan."""

from __future__ import annotations

import copy

from ..knowledge import KnowledgeBase
from ..models import RecommendRequest
from .facts import build_facts, hhmm
from .inference import evaluate_advice, evaluate_route_rules, forward_chain, match_label, score_from
from .planner import plan_ride
from .route_facts import compute_route_fit, public

ROUTE_SUMMARY_KEYS = (
    "id", "name", "region", "summary", "start", "end", "distance_km", "duration_min", "surface",
    "road_quality", "curvature", "difficulty", "elevation_gain_m", "tags", "hazards", "night_safe",
    "best_seasons", "max_fuel_gap_km", "viewpoints", "geometry", "verified",
)


def _route_summary(route: dict) -> dict:
    return {k: route[k] for k in ROUTE_SUMMARY_KEYS}


def recommend(req: RecommendRequest, weather: dict, kb: KnowledgeBase) -> dict:
    facts, clock = build_facts(req, weather, kb)

    trace = forward_chain(facts, kb.context_rules)
    target = facts["derived"].get("photo_target")
    if target in ("sunset", "sunrise"):
        facts["derived"]["golden_moment"] = hhmm(clock.sunset if target == "sunset" else clock.sunrise)
    advice = evaluate_advice(facts, kb.advice_rules)

    ranked, excluded, route_traces = [], [], {}
    for route in kb.routes:
        stops = kb.pitstops_by_route.get(route["id"], [])
        fit = compute_route_fit(route, facts, clock, stops)
        route_facts = {**facts, "route": {**route, "curvature_pct": round(route["curvature"] * 100), "fit": fit}}
        result = evaluate_route_rules(route_facts, kb.route_rules)
        route_traces[route["id"]] = [c["rule_id"] for c in result["contributions"]] + \
            [f["rule_id"] for f in result["filters"]] + [w["rule_id"] for w in result["warnings"]]

        if result["filters"]:
            excluded.append({"route_id": route["id"], "name": route["name"], "reasons": result["filters"]})
            continue

        score, evidence, breakdown = score_from(result["contributions"])
        ranked.append({
            "route": route, "fit": fit, "stops": stops,
            "score": score, "evidence": evidence, "breakdown": breakdown,
            "reasons": sorted(result["contributions"], key=lambda c: -abs(c["delta"])),
            "warnings": result["warnings"],
        })

    ranked.sort(key=lambda r: (-r["evidence"], -r["fit"]["time_fit"], r["fit"]["total_min"]))

    recommendations = []
    for rank, r in enumerate(ranked[: req.limit], start=1):
        plan = plan_ride(r["route"], r["fit"], facts, clock, r["stops"])
        recommendations.append({
            "rank": rank,
            "route": _route_summary(r["route"]),
            "score": r["score"],
            "match": match_label(r["score"]),
            "score_breakdown": r["breakdown"],
            "reasons": r["reasons"],
            "warnings": r["warnings"],
            "stats": public(r["fit"]),
            **plan,
        })

    context = copy.deepcopy(facts)
    return {
        "context": context,
        "advice": advice,
        "recommendations": recommendations,
        "excluded": excluded,
        "considered": len(kb.routes),
        "trace": {"context_rules": trace, "route_rules": route_traces},
    }
