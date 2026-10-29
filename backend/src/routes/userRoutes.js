import express from 'express';
import {
  getUserProfile,
  updateUserProfile,
  toggleWatchStation,
} from '../controllers/userController.js';

const router = express.Router();

// GET /api/user/profile
router.get('/profile', getUserProfile);

// PUT /api/user/profile
router.put('/profile', updateUserProfile);

// POST /api/user/watch/:stationId
router.post('/watch/:stationId', toggleWatchStation);

export default router;
