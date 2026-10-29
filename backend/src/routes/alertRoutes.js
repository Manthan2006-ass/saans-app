import express from 'express';
import {
  getAlerts,
  markAlertRead,
  createAlert,
} from '../controllers/alertController.js';
import { getSpikeAlerts } from '../controllers/forecastController.js';

const router = express.Router();

// GET /api/alerts (with ?city=pune&unreadOnly=true)
router.get('/', getAlerts);

// Legacy/Compatibility GET /api/alerts/spikes
router.get('/spikes', getSpikeAlerts);

// PATCH /api/alerts/:id/read
router.patch('/:id/read', markAlertRead);

// POST /api/alerts
router.post('/', createAlert);

export default router;
