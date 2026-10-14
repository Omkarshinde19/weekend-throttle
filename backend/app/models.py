from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

Intent = Literal["photography", "thrill", "leisure", "food", "adventure"]
BikeType = Literal["cruiser", "sports", "adventure", "street", "scooter"]
Experience = Literal["beginner", "intermediate", "expert"]
WeatherCondition = Literal["clear", "cloudy", "fog", "drizzle", "rain", "heavy_rain", "thunderstorm"]

PUNE = {"lat": 18.5204, "lng": 73.8567}


class LatLng(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class WeatherInput(BaseModel):
    """Simulated weather. Only `condition` is required; the rest get sensible defaults."""

    condition: WeatherCondition
    precip_mm: Optional[float] = Field(None, ge=0, description="mm/hour")
    temp_c: Optional[float] = None
    visibility_km: Optional[float] = Field(None, ge=0)
    wind_kmh: Optional[float] = Field(None, ge=0)


class RecommendRequest(BaseModel):
    intent: Intent
    bike: BikeType
    experience: Experience = "intermediate"
    pillion: bool = False
    start: LatLng = Field(default_factory=lambda: LatLng(**PUNE))
    depart_at: Optional[datetime] = Field(None, description="ISO datetime; naive values are treated as IST. Defaults to now.")
    time_budget_hours: float = Field(5, gt=0.5, le=16)
    weather: Optional[WeatherInput] = Field(None, description="Omit to fetch live weather from Open-Meteo")
    limit: int = Field(5, ge=1, le=20)
