import mongoose from 'mongoose';
import { Station } from '../models/Station.js';
import { Reading } from '../models/Reading.js';
import { getDemoStationsWithLatest, generateDemoReadings } from '../services/demoData.js';

export async function getStations(req, res, next) {
  try {
    const city = req.query.city ? String(req.query.city).toLowerCase() : 'pune';
    let data = [];

    if (mongoose.connection.readyState === 1) {
      const stations = await Station.find({ city }).lean();
      data = await Promise.all(stations.map(async s => {
        // Prioritize ground-station OpenAQ observations up to now
        const groundReading = await Reading.findOne({
          stationId: s.openaqId,
          source: 'openaq-live',
          ts: { $lte: new Date() },
        }).sort({ ts: -1 }).lean();

        const latestReading = groundReading || await Reading.findOne({
          stationId: s.openaqId,
          ts: { $lte: new Date() },
        }).sort({ ts: -1 }).lean() || await Reading.findOne({
          stationId: s.openaqId,
        }).sort({ ts: -1 }).lean();

        return { ...s, latestReading };
      }));
    }

    if (!data.length || data.every(s => !s.latestReading)) {
      data = getDemoStationsWithLatest(city);
    }

    const primarySource = data.find(s => s.latestReading?.source === 'openaq-live')
      ? 'openaq-live'
      : (data[0]?.latestReading?.source || 'demo-fallback');

    res.json({
      data,
      source: primarySource,
      isLiveConnected: mongoose.connection.readyState === 1,
      dataTimestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function getStationReadings(req, res, next) {
  try {
    const stationId = Number(req.params.id);
    const hours = Math.min(720, Math.max(1, Number(req.query.hours) || 72));
    let data = [];

    if (mongoose.connection.readyState === 1) {
      data = await Reading.find({
        stationId,
        ts: { $gte: new Date(Date.now() - hours * 3600000), $lte: new Date() },
      }).sort({ ts: 1 }).lean();
    }

    if (!data.length) {
      data = generateDemoReadings(stationId).slice(-hours);
    }

    res.json({
      data,
      source: data[0]?.source || 'demo',
      dataTimestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}
