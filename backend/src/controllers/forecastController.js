import mongoose from 'mongoose';
import { Station } from '../models/Station.js';
import { Reading } from '../models/Reading.js';
import { Forecast } from '../models/Forecast.js';
import { forecastForStation } from '../services/forecast.js';
import { getDemoForecast, DEMO_STATIONS } from '../services/demoData.js';
import { compareDepartures, detectSpikeEpisodes } from '../services/planner.js';

export async function getStationForecast(req, res, next) {
  try {
    const stationId = Number(req.params.id);
    if (!Number.isInteger(stationId) || stationId <= 0) {
      return res.status(400).json({ error: 'Station id must be a positive number' });
    }

    if (mongoose.connection.readyState === 1) {
      const station = await Station.findOne({ openaqId: stationId }).lean();
      if (station) {
        // Query observed readings up to now for lag feature calculation
        const readings = await Reading.find({
          stationId,
          ts: { $lte: new Date() },
        }).sort({ ts: -1 }).limit(96).lean();

        if (readings.length >= 10) {
          readings.reverse();
          const fc = forecastForStation(station, readings);
          Forecast.updateOne(
            { station: station._id },
            {
              $set: {
                station: station._id,
                stationId: station.openaqId,
                generatedAt: new Date(),
                modelVersion: fc.modelVersion,
                hours: fc.hours,
                drivers: fc.drivers,
              },
            },
            { upsert: true }
          ).catch(() => {});
          return res.json(fc);
        }
      }
    }

    // Fallback: demo forecast
    const demoForecast = getDemoForecast(stationId);
    if (demoForecast) return res.json(demoForecast);
    return res.status(404).json({ error: 'Station not found or insufficient readings' });
  } catch (error) {
    next(error);
  }
}

export async function compareDepartureTimes(req, res, next) {
  try {
    const { stationId, offsetA = 0, offsetB = 2, durationMinutes = 45, mode = 'commute' } = req.body;
    const targetId = Number(stationId || req.query.stationId);
    if (!targetId) {
      return res.status(400).json({ error: 'stationId is required' });
    }

    let forecast = null;
    if (mongoose.connection.readyState === 1) {
      const station = await Station.findOne({ openaqId: targetId }).lean();
      if (station) {
        const readings = await Reading.find({
          stationId: targetId,
          ts: { $lte: new Date() },
        }).sort({ ts: -1 }).limit(96).lean();
        if (readings.length >= 10) {
          readings.reverse();
          forecast = forecastForStation(station, readings);
        }
      }
    }

    if (!forecast) forecast = getDemoForecast(targetId);
    if (!forecast) return res.status(404).json({ error: 'Forecast unavailable for this station' });

    const result = compareDepartures(
      forecast,
      Number(offsetA),
      Number(offsetB),
      Number(durationMinutes),
      mode
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getSpikeAlerts(req, res, next) {
  try {
    const city = req.query.city ? String(req.query.city).toLowerCase() : 'pune';
    let stationsToEvaluate = [];

    if (mongoose.connection.readyState === 1) {
      stationsToEvaluate = await Station.find({ city }).lean();
    }
    if (!stationsToEvaluate.length) {
      stationsToEvaluate = DEMO_STATIONS.filter(s => s.city === city);
    }

    const stationsWithForecast = await Promise.all(stationsToEvaluate.map(async st => {
      let fc = null;
      if (mongoose.connection.readyState === 1) {
        const readings = await Reading.find({
          stationId: st.openaqId,
          ts: { $lte: new Date() },
        }).sort({ ts: -1 }).limit(96).lean();
        if (readings.length >= 10) {
          readings.reverse();
          try { fc = forecastForStation(st, readings); } catch {}
        }
      }
      if (!fc) fc = getDemoForecast(st.openaqId);
      return { station: st, forecast: fc };
    }));

    const alerts = detectSpikeEpisodes(stationsWithForecast);
    res.json({
      alerts,
      city,
      count: alerts.length,
      evaluatedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}
