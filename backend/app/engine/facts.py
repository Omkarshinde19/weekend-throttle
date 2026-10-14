"""Builds the initial working memory (fact base) from a user request."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from ..knowledge import KnowledgeBase
from ..models import RecommendRequest
from .solar import sun_events

IST = timezone(timedelta(hours=5, minutes=30), "IST")

# Pre-dawn departures within this window still count as "twilight", so sunrise rides stay possible.
PRE_DAWN_GRACE_MIN = 45
DUSK_GRACE_MIN = 15


@dataclass(frozen=True)
class RideClock:
    """Datetimes the engine needs that don't belong in the JSON fact base."""

    depart: datetime
    sunrise: datetime
    sunset: datetime


def season_for(month: int) -> str:
    if 6 <= month <= 9:
        return "monsoon"
    if month in (10, 11):
        return "post_monsoon"
    if month in (12, 1, 2):
        return "winter"
    return "summer"


def hhmm(dt: datetime) -> str:
    return dt.strftime("%H:%M")


def minutes_between(a: datetime, b: datetime) -> int:
    return round((b - a).total_seconds() / 60)


def build_facts(req: RecommendRequest, weather: dict, kb: KnowledgeBase) -> tuple[dict, RideClock]:
    depart = req.depart_at or datetime.now(IST)
    if depart.tzinfo is None:
        depart = depart.replace(tzinfo=IST)
    depart = depart.replace(second=0, microsecond=0)

    sun = sun_events(depart.date(), req.start.lat, req.start.lng, depart.tzinfo)
    sunrise, sunset = sun["sunrise"], sun["sunset"]

    departs_in_dark = (
        depart > sunset - timedelta(minutes=DUSK_GRACE_MIN)
        or depart < sunrise - timedelta(minutes=PRE_DAWN_GRACE_MIN)
    )

    facts = {
        "ctx": {
            "intent": req.intent,
            "bike": req.bike,
            "experience": req.experience,
            "pillion": req.pillion,
            "time_budget_hours": req.time_budget_hours,
            "start": req.start.model_dump(),
            "depart_at": depart.isoformat(),
            "weather": weather,
        },
        "bike": {"type": req.bike, **kb.bikes[req.bike]},
        "derived": {
            "hour": round(depart.hour + depart.minute / 60, 2),
            "weekday": depart.strftime("%A"),
            "is_weekend": depart.weekday() >= 5,
            "season": season_for(depart.month),
            "sunrise": hhmm(sunrise),
            "sunset": hhmm(sunset),
            "sunrise_azimuth": sun["sunrise_azimuth"],
            "sunset_azimuth": sun["sunset_azimuth"],
            "minutes_to_sunrise": minutes_between(depart, sunrise),
            "minutes_to_sunset": minutes_between(depart, sunset),
            "departs_in_dark": departs_in_dark,
            "break_factor": 1.0,
        },
    }
    return facts, RideClock(depart=depart, sunrise=sunrise, sunset=sunset)
