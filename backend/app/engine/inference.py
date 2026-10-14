"""Inference engine.

* `forward_chain` — recognise–act cycle over context rules. On each cycle every rule whose
  condition matches the current working memory is a candidate; the one with the highest salience
  fires (conflict resolution), its actions update the facts, and the loop repeats until no rule can
  fire. Each rule fires at most once (refraction), so the loop always terminates.
* `evaluate_route_rules` — applies filter / score / warn rules to one candidate route.
"""

from __future__ import annotations

import math

from .conditions import MISSING, evaluate, get_fact, render, set_fact

SCORE_SPREAD = 45  # +45 points of evidence moves the score from 50 to ~73


def _apply_actions(then: dict, facts: dict) -> list[str]:
    effects = []
    for path, value in then.get("set", {}).items():
        set_fact(facts, path, value)
        effects.append(f"{path} = {value}")
    for path, factor in then.get("multiply", {}).items():
        current = get_fact(facts, path)
        if current is MISSING or current is None:
            continue
        new = round(current * factor, 3)
        set_fact(facts, path, new)
        effects.append(f"{path} = {current} × {factor} = {new}")
    return effects


def forward_chain(facts: dict, rules: list[dict], max_cycles: int = 200) -> list[dict]:
    agenda = sorted(rules, key=lambda r: -r.get("salience", 0))  # stable: file order breaks ties
    fired: set[str] = set()
    trace: list[dict] = []

    for cycle in range(1, max_cycles + 1):
        rule = next((r for r in agenda if r["id"] not in fired and evaluate(r["when"], facts)), None)
        if rule is None:
            break
        fired.add(rule["id"])
        effects = _apply_actions(rule.get("then", {}), facts)
        trace.append({
            "cycle": cycle,
            "rule_id": rule["id"],
            "group": rule.get("group"),
            "salience": rule.get("salience", 0),
            "text": render(rule.get("explain", ""), facts),
            "effects": effects,
        })
    return trace


def evaluate_advice(facts: dict, rules: list[dict]) -> list[dict]:
    return [
        {"rule_id": r["id"], "icon": r.get("icon"), "text": render(r["text"], facts)}
        for r in rules
        if evaluate(r["when"], facts)
    ]


def evaluate_route_rules(facts: dict, rules: list[dict]) -> dict:
    filters, contributions, warnings = [], [], []

    for rule in rules:
        if not evaluate(rule["when"], facts):
            continue
        text = render(rule.get("explain", ""), facts)
        kind = rule["type"]
        if kind == "filter":
            filters.append({"rule_id": rule["id"], "text": text})
        elif kind == "warn":
            warnings.append({"rule_id": rule["id"], "text": text})
        elif kind == "score":
            scale = 1.0
            if "scale_by" in rule:
                v = get_fact(facts, rule["scale_by"])
                scale = float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else 0.0
            delta = round(rule["weight"] * scale, 1)
            if delta:
                contributions.append({
                    "rule_id": rule["id"],
                    "category": rule.get("category", "fit"),
                    "delta": delta,
                    "text": text,
                })
        else:
            raise ValueError(f"Unknown rule type '{kind}' in {rule['id']}")

    return {"filters": filters, "contributions": contributions, "warnings": warnings}


def score_from(contributions: list[dict]) -> tuple[int, float, dict]:
    """Squash summed evidence into 0–100 with a logistic curve (no hard clipping, order preserved)."""
    total = sum(c["delta"] for c in contributions)
    score = round(100 / (1 + math.exp(-total / SCORE_SPREAD)))
    breakdown: dict[str, float] = {"safety": 0.0, "fit": 0.0, "vibe": 0.0, "timing": 0.0}
    for c in contributions:
        breakdown[c["category"]] = round(breakdown.get(c["category"], 0.0) + c["delta"], 1)
    return score, round(total, 1), breakdown


def match_label(score: int) -> str:
    if score >= 85:
        return "Perfect match"
    if score >= 70:
        return "Great pick"
    if score >= 55:
        return "Good option"
    return "Worth a look"
