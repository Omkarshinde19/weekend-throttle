"""Weather facts: live from Open-Meteo (free, no key) or simulated from the UI."""

from __future__ import annotations

import json
import logging
import time
import urllib.parse
import urllib.request
from datetime import datetime

from ..models import WeatherInput

log = logging.getLogger(__name__)

OPEN_METEO = "https://api.open-meteo.com/v1/forecast"

# Typical values used to fill in a simulated condition.
DEFAULTS = {
    "clear":        {"precip_mm": 0.0,  "temp_c": 28, "visibility_km": 10.0, "wind_kmh": 8},
    "cloudy":       {"precip_mm": 0.0,  "temp_c": 26, "visibility_km": 10.0, "wind_kmh": 10},
    "fog":          {"precip_mm": 0.0,  "temp_c": 18, "visibility_km": 0.5,  "wind_kmh": 4},
    "drizzle":      {"precip_mm": 1.0,  "temp_c": 24, "visibility_km": 6.0,  "wind_kmh": 10},
    "rain":         {"precip_mm": 4.0,  "temp_c": 23, "visibility_km": 4.0,  "wind_kmh": 15},
    "heavy_rain":   {"precip_mm": 12.0, "temp_c": 22, "visibility_km": 2.0,  "wind_kmh": 25},
    "thunderstorm": {"precip_mm": 15.0, "temp_c": 24, "visibility_km": 2.0,  "wind_kmh": 35},
}


def from_override(w: WeatherInput) -> dict:
    base = DEFAULTS[w.condition]
    data = {"condition": w.condition, "source": "simulated"}
    for key, default in base.items():
        value = getattr(w, key)
        data[key] = default if value is None else value
    return data


def condition_from_code(code: int, precip_mm: float) -> str:
    """WMO weather code → our condition vocabulary (precipitation can upgrade it)."""
    if code >= 95:
        return "thunderstorm"
    if code in (65, 82) or precip_mm >= 7.5:
        return "heavy_rain"
    if code in (61, 63, 66, 67, 80, 81) or precip_mm >= 2.5:
        return "rain"
    if 51 <= code <= 57 or precip_mm >= 0.2:
        return "drizzle"
    if code in (45, 48):
        return "fog"
    if code in (2, 3) or 71 <= code <= 77:
        return "cloudy"
    return "clear"


_CACHE: dict[tuple, tuple[float, dict]] = {}
CACHE_TTL_S = 600


def _get_json(url: str, timeout: float, attempts: int = 2):
    """GET with one retry — Open-Meteo occasionally answers 503 or is slow to generate."""
    last: Exception | None = None
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(url, timeout=timeout) as resp:
                return json.load(resp)
        except Exception as exc:  # network down, 5xx, timeout
            last = exc
            if attempt + 1 < attempts:
                time.sleep(0.4)
    raise last  # type: ignore[misc]


def fetch_live(lat: float, lng: float, at: datetime, timeout: float = 6.0) -> dict | None:
    key = (round(lat, 2), round(lng, 2), at.strftime("%Y-%m-%dT%H"))
    hit = _CACHE.get(key)
    if hit and time.monotonic() - hit[0] < CACHE_TTL_S:
        return hit[1]

    day = at.strftime("%Y-%m-%d")
    params = {
        "latitude": lat,
        "longitude": lng,
        "hourly": "temperature_2m,precipitation,weather_code,visibility,wind_speed_10m",
        "timezone": "auto",
        # Only the day we're planning for: a much smaller, faster response than a 16-day forecast.
        "start_date": day,
        "end_date": day,
    }
    url = f"{OPEN_METEO}?{urllib.parse.urlencode(params)}"
    try:
        payload = _get_json(url, timeout)
    except Exception as exc:
        log.warning("Open-Meteo request failed: %s", exc)
        return None

    hourly = payload.get("hourly", {})
    hour = at.strftime("%Y-%m-%dT%H:00")
    try:
        i = hourly["time"].index(hour)
    except (KeyError, ValueError):
        return None

    precip = float(hourly["precipitation"][i] or 0)
    visibility_m = hourly.get("visibility", [None] * (i + 1))[i]
    result = {
        "condition": condition_from_code(int(hourly["weather_code"][i] or 0), precip),
        "precip_mm": precip,
        "temp_c": hourly["temperature_2m"][i],
        "visibility_km": round(visibility_m / 1000, 1) if visibility_m is not None else 10.0,
        "wind_kmh": hourly["wind_speed_10m"][i],
        "source": "open-meteo",
        "forecast_for": hour,
    }
    _CACHE[key] = (time.monotonic(), result)
    return result


def resolve_weather(override: WeatherInput | None, lat: float, lng: float, at: datetime) -> dict:
    if override is not None:
        return from_override(override)
    live = fetch_live(lat, lng, at)
    if live:
        return live
    return {"condition": "clear", **DEFAULTS["clear"], "source": "fallback"}
