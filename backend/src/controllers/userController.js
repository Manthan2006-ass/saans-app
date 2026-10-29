import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Station } from '../models/Station.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { DEMO_STATIONS } from '../services/demoData.js';

// Fallback demo user if database is running without persistent records
const DEMO_USER = {
  _id: '671a5c68910243211e400001',
  name: 'Aditya Sharma',
  email: 'aditya@saans.org',
  role: 'user',
  healthProfile: {
    asthma: true,
    athlete: false,
    child: false,
    elderly: false,
  },
  outdoorHoursPerWeek: 8,
  watchedStations: DEMO_STATIONS.slice(0, 3),
};

/**
 * Get current active user profile (includes health profile & watched stations)
 */
export const getUserProfile = asyncHandler(async (req, res) => {
  if (mongoose.connection.readyState === 1) {
    let user = await User.findOne().populate('watchedStations');
    if (!user) {
      const puneStations = await Station.find({ city: 'pune' }).limit(3);
      user = await User.create({
        name: 'Aditya Sharma',
        email: 'aditya@saans.org',
        password: 'hashed_password_123',
        role: 'user',
        healthProfile: {
          asthma: true,
          athlete: false,
          child: false,
          elderly: false,
        },
        outdoorHoursPerWeek: 8,
        watchedStations: puneStations.map(s => s._id),
      });
      user = await user.populate('watchedStations');
    }
    return res.status(200).json(new ApiResponse(200, user, 'User profile fetched successfully'));
  }

  // Offline / Fallback Mode
  return res.status(200).json(new ApiResponse(200, DEMO_USER, 'Demo user profile loaded'));
});

/**
 * Update user health profile & settings
 */
export const updateUserProfile = asyncHandler(async (req, res) => {
  const { name, healthProfile, outdoorHoursPerWeek, watchedStations } = req.body;

  if (mongoose.connection.readyState === 1) {
    let user = await User.findOne();
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    if (name) user.name = name;
    if (outdoorHoursPerWeek !== undefined) user.outdoorHoursPerWeek = outdoorHoursPerWeek;
    if (watchedStations && Array.isArray(watchedStations)) user.watchedStations = watchedStations;

    if (healthProfile) {
      user.healthProfile = {
        asthma: healthProfile.asthma ?? user.healthProfile.asthma,
        athlete: healthProfile.athlete ?? user.healthProfile.athlete,
        child: healthProfile.child ?? user.healthProfile.child,
        elderly: healthProfile.elderly ?? user.healthProfile.elderly,
      };
    }

    await user.save();
    const updated = await User.findById(user._id).populate('watchedStations');
    return res.status(200).json(new ApiResponse(200, updated, 'Profile updated successfully'));
  }

  // Offline update simulation
  if (name) DEMO_USER.name = name;
  if (outdoorHoursPerWeek !== undefined) DEMO_USER.outdoorHoursPerWeek = outdoorHoursPerWeek;
  if (healthProfile) {
    DEMO_USER.healthProfile = { ...DEMO_USER.healthProfile, ...healthProfile };
  }
  return res.status(200).json(new ApiResponse(200, DEMO_USER, 'Profile updated (fallback mode)'));
});

/**
 * Pin or Unpin a station to watchedStations
 */
export const toggleWatchStation = asyncHandler(async (req, res) => {
  const { stationId } = req.params;

  if (mongoose.connection.readyState === 1) {
    let user = await User.findOne();
    if (!user) throw new ApiError(404, 'User not found');

    const station = await Station.findOne({
      $or: [{ _id: mongoose.isValidObjectId(stationId) ? stationId : null }, { openaqId: Number(stationId) }],
    });
    if (!station) throw new ApiError(404, 'Station not found');

    const index = user.watchedStations.findIndex(id => id.toString() === station._id.toString());
    let isWatched = false;
    if (index > -1) {
      user.watchedStations.splice(index, 1);
    } else {
      user.watchedStations.push(station._id);
      isWatched = true;
    }

    await user.save();
    const populated = await User.findById(user._id).populate('watchedStations');
    return res.status(200).json(
      new ApiResponse(200, { user: populated, isWatched }, isWatched ? 'Station pinned' : 'Station unpinned')
    );
  }

  return res.status(200).json(new ApiResponse(200, { isWatched: true }, 'Station pinned (fallback mode)'));
});
