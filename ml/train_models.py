"""Train city/horizon LightGBM models using its native API."""
from __future__ import annotations
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
import numpy as np
import pandas as pd
import lightgbm as lgb

HERE = Path(__file__).resolve().parent
OUTPUT = HERE / "output"
ARTIFACTS = HERE / "artifacts"
HORIZONS = [12, 24, 48, 72]
POLLUTANTS = ["pm25", "pm10"]


def feature_columns(df):
    names = ["stationId", "hour_sin", "hour_cos", "day_of_week", "month", "is_weekend",
             "was_missing"]
    for p in ["pm25", "pm10"]:
        names += [p, p + "_24h", p + "_flatline24"]
        names += [p + "_lag" + str(x) for x in [1, 3, 6, 12, 24, 48]]
        names += [p + "_mean" + str(x) for x in [6, 24, 72]]
        names += [p + "_max" + str(x) for x in [6, 24, 72]]
    return [name for name in names if name in df.columns]


def scores(actual, predicted):
    error = predicted - actual
    return float(np.mean(np.abs(error))), float(np.sqrt(np.mean(error ** 2)))


def train_city(city, test_days):
    source = OUTPUT / (city + "_clean_hourly.csv.gz")
    if not source.exists():
        raise SystemExit("Run prepare_and_benchmark.py first; missing " + str(source))
    df = pd.read_csv(source, parse_dates=["hour"])
    df["hour"] = pd.to_datetime(df["hour"], utc=True)
    features = feature_columns(df)
    matrix = df[features].copy()
    for name in matrix.columns:
        if matrix[name].dtype == bool:
            matrix[name] = matrix[name].astype("int8")
    matrix = matrix.replace([np.inf, -np.inf], np.nan).astype(float)
    cutoff = df["hour"].max() - pd.Timedelta(days=test_days)
    results, saved = [], []
    for pollutant in POLLUTANTS:
        for horizon in HORIZONS:
            target = pd.to_numeric(df["target_" + pollutant + "_h" + str(horizon)], errors="coerce")
            target_time = pd.to_datetime(df["target_hour_h" + str(horizon)], utc=True, errors="coerce")
            train_idx = np.flatnonzero((target.notna() & target_time.lt(cutoff)).to_numpy())
            persistence_values = pd.to_numeric(df[pollutant], errors="coerce")
            yesterday_values = df.groupby("stationId")[pollutant].shift(24)
            test_valid = (target.notna() & target_time.ge(cutoff)
                          & persistence_values.notna() & yesterday_values.notna())
            test_idx = np.flatnonzero(test_valid.to_numpy())
            if len(train_idx) < 500 or len(test_idx) < 100:
                print("Skipping", city, pollutant, horizon, "h: too few rows")
                continue
            data = lgb.Dataset(matrix.iloc[train_idx], label=target.iloc[train_idx])
            params = {
                "objective": "regression", "metric": "l1", "learning_rate": 0.04,
                "num_leaves": 24, "max_depth": -1, "min_data_in_leaf": 30,
                "feature_fraction": 0.85, "bagging_fraction": 0.85,
                "bagging_freq": 1, "lambda_l2": 1.0, "verbosity": -1,
                "num_threads": -1, "seed": 42,
            }
            stem = city + "_" + pollutant + "_h" + str(horizon)
            folder = ARTIFACTS / city
            folder.mkdir(parents=True, exist_ok=True)
            model = lgb.train(params, data, num_boost_round=350)
            predicted = model.predict(matrix.iloc[test_idx])
            mae, rmse = scores(target.iloc[test_idx].to_numpy(), predicted)
            model.save_model(str(folder / (stem + "_p50.txt")))
            (folder / (stem + "_p50.json")).write_text(
                json.dumps(model.dump_model(), separators=(",", ":")), encoding="utf-8"
            )
            record = {
                "city": city, "pollutant": pollutant, "horizon_hours": horizon,
                "model": "LightGBM p50", "mae_ug_m3": mae, "rmse_ug_m3": rmse,
                "samples": len(test_idx), "train_samples": len(train_idx),
                "test_start_utc": cutoff.isoformat(),
                "test_end_utc": target_time.iloc[test_idx].max().isoformat(),
            }
            results.append(record)
            if pollutant == "pm25":
                actual = target.iloc[test_idx].to_numpy()
                for baseline_name, baseline_prediction in [
                    ("Persistence", persistence_values),
                    ("Yesterday at issue", yesterday_values),
                ]:
                    baseline_mae, baseline_rmse = scores(actual, baseline_prediction.iloc[test_idx].to_numpy())
                    results.append({
                        "city": city, "pollutant": pollutant, "horizon_hours": horizon,
                        "model": baseline_name, "mae_ug_m3": baseline_mae,
                        "rmse_ug_m3": baseline_rmse, "samples": len(test_idx),
                        "train_samples": len(train_idx), "test_start_utc": cutoff.isoformat(),
                        "test_end_utc": target_time.iloc[test_idx].max().isoformat(),
                    })
            saved.append({**record, "features": features})
            if pollutant == "pm25":
                for q in [0.1, 0.9]:
                    quantile_params = {**params, "objective": "quantile", "metric": "quantile", "alpha": q}
                    quantile_model = lgb.train(quantile_params, data, num_boost_round=350)
                    suffix = "p" + str(int(q * 100))
                    quantile_model.save_model(str(folder / (stem + "_" + suffix + ".txt")))
                    (folder / (stem + "_" + suffix + ".json")).write_text(
                        json.dumps(quantile_model.dump_model(), separators=(",", ":")), encoding="utf-8"
                    )
    metadata = {
        "city": city, "trained_at_utc": datetime.now(timezone.utc).isoformat(),
        "training_data": str(source), "last_available_hour_utc": df["hour"].max().isoformat(),
        "test_days": test_days, "runtime_weather_features": False, "models": saved,
    }
    (ARTIFACTS / city / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return results


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cities", nargs="+", choices=["pune", "delhi"], default=["pune", "delhi"])
    parser.add_argument("--test-days", type=int, default=60)
    args = parser.parse_args()
    rows = []
    for city in args.cities:
        print("Training", city, flush=True)
        rows.extend(train_city(city, args.test_days))
    report = pd.DataFrame(rows)
    destination = OUTPUT / "model_metrics.csv"
    report.to_csv(destination, index=False)
    print("Saved learned-model scores to", destination)
    if not report.empty:
        print(report.to_string(index=False))


if __name__ == "__main__":
    main()



