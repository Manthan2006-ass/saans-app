# SAANS: local air quality forecasts

SAANS is a React + Express + MongoDB application for viewing monitoring-station readings in Pune and Delhi and estimating PM2.5/PM10 concentrations 12, 24, 48, and 72 hours ahead. Python is used offline to prepare data and train LightGBM models; the running Express service loads the exported models in Node.js. There is no FastAPI service.

## Run locally

Requirements: Node.js 20 or newer, a MongoDB database, and an OpenAQ API key.

1. Install Node packages with `npm install`.
2. Copy `.env.example` to `.env`; set `MONGODB_URI` and `OPENAQ_API_KEY`. Keep `.env` private.
3. In one terminal run `npm run dev` from this folder. On first startup the service syncs usable stations from `../reports/coverage_report.csv` and fetches latest readings. It then refreshes readings hourly.
4. In a second terminal run `npm run dev:client` and open `http://localhost:5173`. Vite forwards API requests to Express on port 3000.

To build the React app for Express, run `npm run build`; then start the backend with `npm start` and open `http://localhost:3000`.

## Model training

Python is only needed to rebuild the models. Install the packages in `ml/requirements.txt`, then run `ml/prepare_and_benchmark.py` followed by `ml/train_models.py`. The trainer writes native LightGBM files and JSON trees under `ml/artifacts/`; the running Node service reads the JSON trees. Prepared data and evaluation tables are under `ml/output/`.

## API

- `GET /health`
- `GET /api/stations?city=pune` (or `delhi`)
- `GET /api/stations/:id/readings?hours=72`
- `GET /api/stations/:id/forecast`

Forecast values are pollutant concentrations in µg/m³, not AQI. The PM2.5 range is formed from separately trained lower and upper quantile models; it has not yet been checked for real-world coverage calibration. Current production inference uses recent PM readings and calendar/station features. Weather predictors are excluded from the refreshed models because the live app does not yet supply weather.

## Current evidence and limits

See [ml/MODEL_CARD.md](ml/MODEL_CARD.md) for inputs, holdout results, and limitations. Current training data ends on 4 October 2026. The holdout is time-based but uses the same stations as training; performance across new stations, later seasons, and future live data has not been established. These forecasts are decision-support estimates, not official CPCB AQI readings or health advice.

Before a public pilot: integrate and retain live weather consistently in both training and inference (or keep it excluded), monitor data quality and forecast errors, calibrate uncertainty ranges, add complete CPCB AQI only when required pollutant/averaging data are available, and deploy with secrets, access controls, logging, backups, and uptime monitoring.
