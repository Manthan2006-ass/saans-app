import express from 'express';
import { getAccountabilityReport } from '../services/accountability.js';

const router = express.Router();

// GET /api/accountability?city=pune
router.get('/', (req, res) => {
  const city = req.query.city || 'pune';
  res.json(getAccountabilityReport(city));
});

export default router;
