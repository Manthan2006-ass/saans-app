import mongoose from 'mongoose';
import { Station } from '../models/Station.js';
import { Reading } from '../models/Reading.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { DEMO_STATIONS, generateDemoReadings } from '../services/demoData.js';
import { optimizeCommuteRoute, CORRIDOR_PRESETS } from '../services/commuteOptimizer.js';

/**
 * Get available corridors for a city
 */
export const getCorridors = asyncHandler(async (req, res) => {
  const city = (req.query.city || 'pune').toLowerCase();
  const list = CORRIDOR_PRESETS[city] || CORRIDOR_PRESETS.pune;
  return res.status(200).json(new ApiResponse(200, list, `Commute corridors for ${city}`));
});

/**
 * Compute optimized commute exposure & comparisons
 */
export const getCommuteOptimization = asyncHandler(async (req, res) => {
  const city = (req.query.city || req.body.city || 'pune').toLowerCase();
  const corridorId = req.query.corridorId || req.body.corridorId;
  const mode = req.query.mode || req.body.mode || 'bike_scooter';

  let currentPM25 = 65;

  // Retrieve live PM2.5 if database connected
  if (mongoose.connection.readyState === 1) {
    const station = await Station.findOne({ city });
    if (station) {
      const latestReading = await Reading.findOne({
        $or: [{ station: station._id }, { stationId: station.openaqId }],
      }).sort({ ts: -1 });
      if (latestReading?.pm25) {
        currentPM25 = latestReading.pm25;
      }
    }
  } else {
    const fallbackStation = DEMO_STATIONS.find(s => s.city === city) || DEMO_STATIONS[0];
    const demoR = generateDemoReadings(fallbackStation.openaqId);
    currentPM25 = demoR[demoR.length - 1]?.pm25 || 65;
  }

  const result = optimizeCommuteRoute({
    city,
    corridorId,
    basePM25: currentPM25,
    mode,
  });

  return res.status(200).json(new ApiResponse(200, result, 'Commute route optimization computed'));
});

