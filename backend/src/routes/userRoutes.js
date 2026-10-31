import express from 'express';
import {
  getUserProfile,
  updateUserProfile,
  toggleWatchStation,
  registerUser,
  loginUser,
  logoutUser,
} from '../controllers/userController.js';

const router = express.Router();

// GET /api/user/profile
router.get('/profile', getUserProfile);

// PUT /api/user/profile
router.put('/profile', updateUserProfile);

// POST /api/user/watch/:stationId
router.post('/watch/:stationId', toggleWatchStation);

// POST /api/user/register
router.post('/register', registerUser);

// POST /api/user/login
router.post('/login', loginUser);

// POST /api/user/logout
router.post('/logout', logoutUser);

export default router;
