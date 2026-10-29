import express from 'express';
import {
  getStationForecast,
  compareDepartureTimes,
  getSpikeAlerts,
} from '../controllers/forecastController.js';

const router = express.Router();

// GET /api/forecast/station/:id OR /api/stations/:id/forecast
router.get('/:id', getStationForecast);

// POST /api/forecast/compare
router.post('/compare', compareDepartureTimes);

// GET /api/forecast/alerts?city=pune
router.get('/alerts/spikes', getSpikeAlerts);

export default router;
