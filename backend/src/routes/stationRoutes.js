import express from 'express';
import { getStations, getStationReadings } from '../controllers/stationController.js';

const router = express.Router();

// GET /api/stations?city=pune
router.get('/', getStations);

// GET /api/stations/:id/readings?hours=72
router.get('/:id/readings', getStationReadings);

export default router;
