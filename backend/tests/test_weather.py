"""Live weather: retries a flaky Open-Meteo, caches results, falls back cleanly."""

import io
import json
from datetime import datetime

import pytest

from app.engine.facts import IST
from app.services import weather

AT = datetime(2026, 10, 17, 15, 30, tzinfo=IST)
PAYLOAD = {
    "hourly": {
        "time": ["2026-10-17T14:00", "2026-10-17T15:00"],
        "temperature_2m": [31.0, 30.5],
        "precipitation": [0.0, 9.0],
        "weather_code": [1, 63],
        "visibility": [12000, 3000],
        "wind_speed_10m": [8, 12],
    }
}


@pytest.fixture(autouse=True)
def no_sleep_and_clean_cache(monkeypatch):
    monkeypatch.setattr(weather.time, "sleep", lambda s: None)
    weather._CACHE.clear()


def fake_urlopen(responses, calls):
    def opener(url, timeout):
        calls.append(url)
        r = responses.pop(0)
        if isinstance(r, Exception):
            raise r
        return io.BytesIO(json.dumps(r).encode())
    return opener


def test_reads_the_requested_hour_for_one_day_only(monkeypatch):
    calls = []
    monkeypatch.setattr(weather.urllib.request, "urlopen", fake_urlopen([PAYLOAD], calls))
    w = weather.fetch_live(18.52, 73.85, AT)
    assert w["source"] == "open-meteo" and w["forecast_for"] == "2026-10-17T15:00"
    assert w["condition"] == "heavy_rain"  # 9 mm/h upgrades the WMO "rain" code
    assert "start_date=2026-10-17" in calls[0] and "end_date=2026-10-17" in calls[0]


def test_retries_once_after_a_503(monkeypatch):
    calls = []
    monkeypatch.setattr(weather.urllib.request, "urlopen", fake_urlopen([OSError("503"), PAYLOAD], calls))
    assert weather.fetch_live(18.52, 73.85, AT)["source"] == "open-meteo"
    assert len(calls) == 2


def test_caches_repeat_requests(monkeypatch):
    calls = []
    monkeypatch.setattr(weather.urllib.request, "urlopen", fake_urlopen([PAYLOAD], calls))
    weather.fetch_live(18.52, 73.85, AT)
    weather.fetch_live(18.52, 73.85, AT.replace(minute=50))  # same hour → cached
    assert len(calls) == 1


def test_falls_back_when_open_meteo_is_down(monkeypatch):
    calls = []
    monkeypatch.setattr(weather.urllib.request, "urlopen", fake_urlopen([OSError("down"), OSError("down")], calls))
    assert weather.fetch_live(18.52, 73.85, AT) is None
    assert weather.resolve_weather(None, 18.52, 73.85, AT)["source"] == "fallback"
