import express from 'express';
import { getCorridors, getCommuteOptimization } from '../controllers/commuteController.js';

const router = express.Router();

// GET /api/commute/corridors
router.get('/corridors', getCorridors);

// GET & POST /api/commute/optimize
router.get('/optimize', getCommuteOptimization);
router.post('/optimize', getCommuteOptimization);

export default router;

