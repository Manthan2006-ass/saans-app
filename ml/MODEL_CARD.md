# SAANS model card

## Purpose

Estimate hourly PM2.5 and PM10 concentrations at existing monitoring stations in Pune and Delhi for 12, 24, 48, and 72 hours after the latest available station hour. The feature service does not produce a full CPCB AQI. Do not present a concentration estimate as an AQI value.

## Model and inputs

The current models are LightGBM regressors, trained separately for each city, pollutant, and horizon. They use only inputs the live forecast service can currently construct:

- Station ID and hour/day/month calendar signals.
- Current PM2.5 and PM10, their 24-hour averages, and lagged readings at 1, 3, 6, 12, 24, and 48 hours.
- Recent 6-, 24-, and 72-hour means and maxima, missing-reading and flat-line indicators.

The target is the station's hourly concentration at the requested future horizon. PM2.5 also has separately trained 10th- and 90th-percentile models for an estimated range. Weather is deliberately excluded from this version: historical weather exists, but live inference does not yet provide matching weather inputs.

## Evaluation

The model was evaluated using a chronological 60-day holdout. Each PM2.5 baseline is scored on the same rows as the model for that city and horizon. The latest target in the source data is 4 October 2026. MAE is in µg/m³; lower is better.

| City | Horizon | LightGBM MAE | Persistence MAE | Yesterday MAE |
|---|---:|---:|---:|---:|
| Pune | 12 h | 6.44 | 7.62 | 8.65 |
| Pune | 24 h | 6.82 | 7.51 | 8.26 |
| Pune | 48 h | 8.62 | 8.30 | 8.92 |
| Pune | 72 h | 8.65 | 8.85 | 9.01 |
| Delhi | 12 h | 17.39 | 21.12 | 24.08 |
| Delhi | 24 h | 18.61 | 21.26 | 23.52 |
| Delhi | 48 h | 20.51 | 23.69 | 26.03 |
| Delhi | 72 h | 21.92 | 26.10 | 27.57 |

The model beats both PM2.5 baselines for seven of eight city/horizon pairs. Pune at 48 hours is the exception: persistence is better. A single holdout is not proof of production performance.

## Important limitations

- Data stops on 4 October 2026; the current model is not freshly trained on live data.
- Train and holdout share stations. Generalization to unseen stations has not been evaluated.
- Seasonal robustness, live error monitoring, and retraining cadence have not been established.
- The 10th/90th percentile range has not been evaluated for coverage or calibration.
- Input gaps, sensor errors, station changes, and OpenAQ reporting delays can affect forecasts; stale readings are flagged.
- No complete CPCB AQI is provided. CPCB AQI uses pollutant-specific sub-indices and the worst sub-index; it requires the necessary pollutants and averaging periods. See [CPCB National AQI report](https://cpcb.nic.in/displaypdf.php?id=bWFudWFsLW1vbml0b3JpbmcvQVFJX05BTVBfUmVwX1NlcHRlbWJlcjIwMTYucGRm).
- The forecasts are estimates for station locations, not street-level measurements, official alerts, or medical advice.

## Next validation milestones

1. Add a repeatable historical backtest over multiple time windows and compare every horizon against persistence.
2. Measure quantile interval coverage and width; calibrate ranges on a separate validation period.
3. Add live error tracking against subsequently observed station readings.
4. If adding weather, ensure historical and live weather use the same variables, units, timestamps, and missing-value handling; retrain and re-evaluate before deployment.
5. Evaluate generalization by holding out entire stations and later seasons.
