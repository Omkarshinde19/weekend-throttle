"""Condition DSL used by every rule in the knowledge base.

A condition is one of:
    {"all": [cond, ...]}     every sub-condition is true
    {"any": [cond, ...]}     at least one is true
    {"not": cond}            negation
    {"fact": "a.b.c", "op": "<op>", "value": X}         compare a fact with a literal
    {"fact": "a.b.c", "op": "<op>", "value_fact": "x.y"} compare two facts

A fact that doesn't exist makes every comparison false (except `exists`).
"""

from __future__ import annotations

import re
from typing import Any, Callable

MISSING = object()


def get_fact(facts: dict, path: str) -> Any:
    node: Any = facts
    for part in path.split("."):
        if isinstance(node, dict) and part in node:
            node = node[part]
        else:
            return MISSING
    return node


def set_fact(facts: dict, path: str, value: Any) -> None:
    parts = path.split(".")
    node = facts
    for part in parts[:-1]:
        node = node.setdefault(part, {})
    node[parts[-1]] = value


def _as_list(v: Any) -> list:
    return v if isinstance(v, (list, tuple, set)) else [v]


OPERATORS: dict[str, Callable[[Any, Any], bool]] = {
    "eq": lambda a, b: a == b,
    "ne": lambda a, b: a != b,
    "in": lambda a, b: a in b,
    "not_in": lambda a, b: a not in b,
    "contains": lambda a, b: b in _as_list(a),
    "contains_any": lambda a, b: any(x in _as_list(a) for x in b),
    "gt": lambda a, b: a > b,
    "gte": lambda a, b: a >= b,
    "lt": lambda a, b: a < b,
    "lte": lambda a, b: a <= b,
    "between": lambda a, b: b[0] <= a <= b[1],
}


def evaluate(cond: dict, facts: dict) -> bool:
    if "all" in cond:
        return all(evaluate(c, facts) for c in cond["all"])
    if "any" in cond:
        return any(evaluate(c, facts) for c in cond["any"])
    if "not" in cond:
        return not evaluate(cond["not"], facts)

    actual = get_fact(facts, cond["fact"])
    op = cond["op"]
    if op == "exists":
        return actual is not MISSING and actual is not None
    if actual is MISSING or actual is None:
        return False

    expected = get_fact(facts, cond["value_fact"]) if "value_fact" in cond else cond.get("value")
    if expected is MISSING:
        return False
    try:
        return OPERATORS[op](actual, expected)
    except KeyError:
        raise ValueError(f"Unknown operator '{op}' in condition {cond}") from None
    except TypeError:
        return False


_PLACEHOLDER = re.compile(r"\{([a-zA-Z0-9_.]+)\}")


def _fmt(value: Any) -> str:
    if isinstance(value, float):
        return str(int(value)) if value.is_integer() else f"{value:.1f}"
    if isinstance(value, (list, tuple)):
        return ", ".join(_fmt(v) for v in value)
    return str(value)


def render(template: str, facts: dict) -> str:
    """Fill `{path.to.fact}` placeholders in an explanation string."""

    def sub(m: re.Match) -> str:
        v = get_fact(facts, m.group(1))
        return "?" if v is MISSING or v is None else _fmt(v)

    return _PLACEHOLDER.sub(sub, template)
