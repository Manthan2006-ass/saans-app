"""CPCB-style PM-based AQI helpers.

AQI here uses PM2.5 and PM10 only; it is not a full-pollutant CPCB AQI.
Confirm breakpoint details against the official CPCB table before publishing.
"""
import numpy as np

PM25_X = np.array([0, 30, 60, 90, 120, 250, 500], dtype=float)
PM10_X = np.array([0, 50, 100, 250, 350, 430, 600], dtype=float)
INDEX_X = np.array([0, 50, 100, 200, 300, 400, 500], dtype=float)


def subindex(concentration, breakpoints):
    values = np.asarray(concentration, dtype=float)
    return np.interp(values, breakpoints, INDEX_X, left=np.nan, right=500)


def pm_aqi(pm25_24h, pm10_24h):
    """Return max PM2.5/PM10 sub-index; NaN if both inputs are missing."""
    return np.fmax(subindex(pm25_24h, PM25_X), subindex(pm10_24h, PM10_X))


def category(aqi):
    if not np.isfinite(aqi):
        return "Unknown"
    if aqi <= 50:
        return "Good"
    if aqi <= 100:
        return "Satisfactory"
    if aqi <= 200:
        return "Moderate"
    if aqi <= 300:
        return "Poor"
    if aqi <= 400:
        return "Very Poor"
    return "Severe"
