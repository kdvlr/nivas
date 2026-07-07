"""Weather via Open-Meteo (free, no API key). Cached in memory for 30 minutes."""

import logging
import time

import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..services.sync import get_setting, set_setting

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/weather", tags=["weather"])

CACHE_TTL = 30 * 60
_cache: dict = {"at": 0.0, "key": "", "data": None}

# WMO weather codes -> (emoji, label, kind)
WMO: dict[int, tuple[str, str, str]] = {
    0: ("☀️", "Sunny", "sunny"),
    1: ("🌤️", "Mostly sunny", "sunny"),
    2: ("⛅", "Partly cloudy", "cloudy"),
    3: ("☁️", "Cloudy", "cloudy"),
    45: ("🌫️", "Foggy", "cloudy"),
    48: ("🌫️", "Foggy", "cloudy"),
    51: ("🌦️", "Drizzle", "rainy"),
    53: ("🌦️", "Drizzle", "rainy"),
    55: ("🌧️", "Heavy drizzle", "rainy"),
    56: ("🌧️", "Freezing drizzle", "rainy"),
    57: ("🌧️", "Freezing drizzle", "rainy"),
    61: ("🌧️", "Light rain", "rainy"),
    63: ("🌧️", "Rain", "rainy"),
    65: ("🌧️", "Heavy rain", "rainy"),
    66: ("🌧️", "Freezing rain", "rainy"),
    67: ("🌧️", "Freezing rain", "rainy"),
    71: ("🌨️", "Light snow", "snowy"),
    73: ("🌨️", "Snow", "snowy"),
    75: ("❄️", "Heavy snow", "snowy"),
    77: ("🌨️", "Snow grains", "snowy"),
    80: ("🌦️", "Showers", "rainy"),
    81: ("🌧️", "Showers", "rainy"),
    82: ("⛈️", "Heavy showers", "rainy"),
    85: ("🌨️", "Snow showers", "snowy"),
    86: ("🌨️", "Snow showers", "snowy"),
    95: ("⛈️", "Thunderstorm", "stormy"),
    96: ("⛈️", "Thunderstorm", "stormy"),
    99: ("⛈️", "Thunderstorm", "stormy"),
}


def _describe(code: int) -> dict:
    emoji, label, kind = WMO.get(code, ("🌡️", "Weather", "cloudy"))
    return {"code": code, "icon": emoji, "label": label, "kind": kind}


class LocationPut(BaseModel):
    lat: float
    lon: float
    unit: str = "fahrenheit"  # or "celsius"


def _location(db: Session) -> dict | None:
    loc = get_setting(db, "weather_location")
    return loc if isinstance(loc, dict) and "lat" in loc and "lon" in loc else None


@router.put("/location")
async def put_location(body: LocationPut, db: Session = Depends(get_db)):
    set_setting(db, "weather_location", {"lat": body.lat, "lon": body.lon, "unit": body.unit})
    _cache["at"] = 0.0  # force refresh
    return {"ok": True}


@router.get("")
async def weather(db: Session = Depends(get_db)):
    loc = _location(db)
    if loc is None:
        return {"configured": False, "current": None, "daily": []}

    key = f"{loc['lat']:.3f},{loc['lon']:.3f},{loc.get('unit', 'fahrenheit')}"
    if _cache["data"] is not None and _cache["key"] == key and time.time() - _cache["at"] < CACHE_TTL:
        return _cache["data"]

    params = {
        "latitude": loc["lat"],
        "longitude": loc["lon"],
        "current": "temperature_2m,weather_code",
        "daily": "weather_code,temperature_2m_max,temperature_2m_min",
        "temperature_unit": loc.get("unit", "fahrenheit"),
        "timezone": get_settings().tz,
        "forecast_days": 14,
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get("https://api.open-meteo.com/v1/forecast", params=params)
            resp.raise_for_status()
            raw = resp.json()
    except Exception as e:
        log.warning("weather fetch failed: %s", e)
        # serve stale data if we have it
        return _cache["data"] or {"configured": True, "current": None, "daily": [], "error": str(e)}

    cur = raw.get("current", {})
    daily_raw = raw.get("daily", {})
    data = {
        "configured": True,
        "current": {
            "temp": round(cur.get("temperature_2m", 0)),
            **_describe(int(cur.get("weather_code", 0))),
        },
        "daily": [
            {
                "date": d,
                "tmax": round(daily_raw["temperature_2m_max"][i]),
                "tmin": round(daily_raw["temperature_2m_min"][i]),
                **_describe(int(daily_raw["weather_code"][i])),
            }
            for i, d in enumerate(daily_raw.get("time", []))
        ],
    }
    _cache.update({"at": time.time(), "key": key, "data": data})
    return data
