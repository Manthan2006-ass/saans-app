"""Prepare usable-station hourly data and evaluate simple time-series baselines."""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"
REPORT = ROOT / "reports" / "coverage_report.csv"
OUTPUT = Path(__file__).resolve().parent / "output"
POLLUTANTS = ["pm25", "pm10", "no2", "so2", "co", "o3"]
WEATHER = {
    "temperature_2m": "temp",
    "relative_humidity_2m": "humidity",
    "wind_speed_10m": "windSpeed",
    "wind_direction_10m": "windDir",
    "surface_pressure": "pressure",
    "precipitation": "rain",
}


def usable_ids(city: str) -> list[int]:
    report = pd.read_csv(REPORT)
    usable = report[report["USABLE"].astype(str).str.lower().eq("true")]
    return sorted(usable.loc[usable["city"].str.lower().eq(city), "location_id"].astype(int).unique())


def load_station(city: str, station_id: int) -> pd.DataFrame:
    path = DATA / "openaq" / city / (str(station_id) + ".csv.gz")
    if not path.exists():
        print("Skipping missing station file:", path)
        return pd.DataFrame()
    frame = pd.read_csv(path)
    if "hour" not in frame:
        print("Skipping file without hour column:", path)
        return pd.DataFrame()
    frame["hour"] = pd.to_datetime(frame["hour"], utc=True, errors="coerce").dt.floor("h")
    for name in POLLUTANTS:
        if name not in frame:
            frame[name] = np.nan
        frame[name] = pd.to_numeric(frame[name], errors="coerce")
        frame.loc[frame[name] < 0, name] = np.nan
    for name in ["pm25", "pm10"]:
        frame.loc[frame[name] > 1000, name] = np.nan
    frame = frame.dropna(subset=["hour"]).groupby("hour", as_index=False)[POLLUTANTS].mean()
    if frame.empty:
        return frame
    hours = pd.date_range(frame["hour"].min(), frame["hour"].max(), freq="h", tz="UTC")
    frame = frame.set_index("hour").reindex(hours)
    frame.index.name = "hour"
    frame = frame.reset_index()
    frame["stationId"] = station_id
    frame["city"] = city
    return frame


def load_weather(city: str) -> pd.DataFrame:
    path = DATA / "weather" / (city + ".csv")
    if not path.exists():
        print("Weather file missing for", city)
        return pd.DataFrame(columns=["hour", *WEATHER.values()])
    weather = pd.read_csv(path)
    if "hour" not in weather:
        return pd.DataFrame(columns=["hour", *WEATHER.values()])
    weather["hour"] = pd.to_datetime(weather["hour"], utc=True, errors="coerce").dt.floor("h")
    weather = weather.rename(columns=WEATHER)
    keep = ["hour", *[name for name in WEATHER.values() if name in weather]]
    return weather[keep].dropna(subset=["hour"]).drop_duplicates("hour").sort_values("hour")


def prepare_city(city: str) -> pd.DataFrame:
    frames = [load_station(city, station_id) for station_id in usable_ids(city)]
    frames = [frame for frame in frames if not frame.empty]
    if not frames:
        raise RuntimeError("No usable station data found for " + city)
    df = pd.concat(frames, ignore_index=True).sort_values(["stationId", "hour"])
    grouped = df.groupby("stationId", group_keys=False)
    df["was_missing"] = df[["pm25", "pm10"]].isna().any(axis=1)
    # Flat-line flags identify suspicious 24-hour constant runs without deleting readings.
    for pollutant in ["pm25", "pm10"]:
        rolling_min = grouped[pollutant].rolling(24, min_periods=24).min().reset_index(level=0, drop=True)
        rolling_max = grouped[pollutant].rolling(24, min_periods=24).max().reset_index(level=0, drop=True)
        df[pollutant + "_flatline24"] = rolling_min.eq(rolling_max) & rolling_min.notna()
        df[pollutant] = grouped[pollutant].transform(
            lambda s: s.interpolate(method="linear", limit=3, limit_area="inside")
        )
    df = df.merge(load_weather(city), on="hour", how="left", validate="many_to_one")

    # 24-hour rolling averages require at least 16 observed/interpolated hours.
    for pollutant in ["pm25", "pm10"]:
        df[pollutant + "_24h"] = df.groupby("stationId")[pollutant].transform(
            lambda s: s.rolling(24, min_periods=16).mean()
        )
    from aqi import pm_aqi, category

    df["pm_aqi"] = pm_aqi(df["pm25_24h"], df["pm10_24h"])
    df["pm_aqi_category"] = df["pm_aqi"].map(category)
    df["hour_sin"] = np.sin(2 * np.pi * df["hour"].dt.hour / 24)
    df["hour_cos"] = np.cos(2 * np.pi * df["hour"].dt.hour / 24)
    df["day_of_week"] = df["hour"].dt.dayofweek
    df["month"] = df["hour"].dt.month
    df["is_weekend"] = df["day_of_week"].isin([5, 6]).astype(int)

    # Features use information available no later than the forecast issue hour.
    for pollutant in ["pm25", "pm10"]:
        by_station = df.groupby("stationId")[pollutant]
        for lag in [1, 3, 6, 12, 24, 48]:
            df[pollutant + "_lag" + str(lag)] = by_station.shift(lag)
        previous = by_station.shift(1)
        for window in [6, 24, 72]:
            df[pollutant + "_mean" + str(window)] = previous.groupby(df["stationId"]).transform(
                lambda s: s.rolling(window, min_periods=max(3, window // 2)).mean()
            )
            df[pollutant + "_max" + str(window)] = previous.groupby(df["stationId"]).transform(
                lambda s: s.rolling(window, min_periods=max(3, window // 2)).max()
            )

    # Baselines: persist the latest reading, or use the reading 24 hours before issue time.
    for horizon in [12, 24, 48, 72]:
        df["target_pm25_h" + str(horizon)] = df.groupby("stationId")["pm25"].shift(-horizon)
        df["target_pm10_h" + str(horizon)] = df.groupby("stationId")["pm10"].shift(-horizon)
        df["target_hour_h" + str(horizon)] = df.groupby("stationId")["hour"].shift(-horizon)
        df["persistence_pm25_h" + str(horizon)] = df["pm25"]
        df["yesterday_pm25_h" + str(horizon)] = df.groupby("stationId")["pm25"].shift(24)

    return df


def evaluate_baselines(df: pd.DataFrame, city: str, test_days: int = 60) -> list[dict]:
    latest_target = pd.to_datetime(df["hour"], utc=True).max()
    cutoff = latest_target - pd.Timedelta(days=test_days)
    rows = []
    for horizon in [12, 24, 48, 72]:
        target_col = "target_pm25_h" + str(horizon)
        target_time = "target_hour_h" + str(horizon)
        valid = df[target_col].notna() & pd.to_datetime(df[target_time], utc=True).ge(cutoff)
        for label, prediction_col in [
            ("persistence", "persistence_pm25_h" + str(horizon)),
            ("yesterday_at_issue", "yesterday_pm25_h" + str(horizon)),
        ]:
            sample = df.loc[valid & df[prediction_col].notna(), [target_col, prediction_col]]
            if sample.empty:
                mae = rmse = np.nan
            else:
                error = sample[prediction_col].to_numpy() - sample[target_col].to_numpy()
                mae = float(np.mean(np.abs(error)))
                rmse = float(np.sqrt(np.mean(error ** 2)))
            rows.append({
                "city": city, "horizon_hours": horizon, "baseline": label,
                "mae_ug_m3": mae, "rmse_ug_m3": rmse, "samples": len(sample),
                "test_start_utc": cutoff.isoformat(), "test_end_utc": latest_target.isoformat(),
                "target": "hourly PM2.5",
            })
    return rows


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cities", nargs="+", choices=["pune", "delhi"], default=["pune", "delhi"])
    parser.add_argument("--test-days", type=int, default=60)
    args = parser.parse_args()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    metrics = []
    for city in args.cities:
        print("Preparing", city)
        df = prepare_city(city)
        clean_path = OUTPUT / (city + "_clean_hourly.csv.gz")
        df.to_csv(clean_path, index=False, compression="gzip")
        metrics.extend(evaluate_baselines(df, city, args.test_days))
        print("Saved", len(df), "station-hours to", clean_path)
    metric_path = OUTPUT / "baseline_metrics.csv"
    pd.DataFrame(metrics).to_csv(metric_path, index=False)
    print("Saved baseline metrics to", metric_path)
    print(pd.DataFrame(metrics).to_string(index=False))


if __name__ == "__main__":
    main()
