"""Sunrise / sunset times and sun direction (NOAA approximation, ±2 min).

Azimuth is measured clockwise from north: 90 = east, 270 = west.
"""

from __future__ import annotations

import math
from datetime import date, datetime, timedelta, timezone, tzinfo

ZENITH_DEG = 90.833  # sun's upper limb at the horizon, with refraction


def sun_events(d: date, lat: float, lng: float, tz: tzinfo) -> dict:
    doy = d.timetuple().tm_yday
    g = 2 * math.pi / 365 * (doy - 1)

    eqtime = 229.18 * (
        0.000075 + 0.001868 * math.cos(g) - 0.032077 * math.sin(g)
        - 0.014615 * math.cos(2 * g) - 0.040849 * math.sin(2 * g)
    )
    decl = (
        0.006918 - 0.399912 * math.cos(g) + 0.070257 * math.sin(g)
        - 0.006758 * math.cos(2 * g) + 0.000907 * math.sin(2 * g)
        - 0.002697 * math.cos(3 * g) + 0.00148 * math.sin(3 * g)
    )

    lat_r = math.radians(lat)
    cos_ha = (math.cos(math.radians(ZENITH_DEG)) / (math.cos(lat_r) * math.cos(decl))
              - math.tan(lat_r) * math.tan(decl))
    ha = math.degrees(math.acos(max(-1.0, min(1.0, cos_ha))))

    midnight_utc = datetime(d.year, d.month, d.day, tzinfo=timezone.utc)
    sunrise = midnight_utc + timedelta(minutes=720 - 4 * (lng + ha) - eqtime)
    sunset = midnight_utc + timedelta(minutes=720 - 4 * (lng - ha) - eqtime)

    sunrise_az = math.degrees(math.acos(max(-1.0, min(1.0, math.sin(decl) / math.cos(lat_r)))))
    return {
        "sunrise": sunrise.astimezone(tz),
        "sunset": sunset.astimezone(tz),
        "sunrise_azimuth": round(sunrise_az, 1),
        "sunset_azimuth": round(360 - sunrise_az, 1),
    }


def angle_diff(a: float, b: float) -> float:
    """Smallest absolute difference between two compass bearings (0–180)."""
    d = abs(a - b) % 360
    return 360 - d if d > 180 else d
