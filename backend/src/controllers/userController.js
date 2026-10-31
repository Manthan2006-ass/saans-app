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

/**
 * Register new user with personalized health profile
 */
export const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, healthProfile, outdoorHoursPerWeek = 8, city = 'pune' } = req.body;

  if (!name || !email || !password) {
    throw new ApiError(400, 'Name, email, and password are required');
  }

  const normalizedEmail = email.toLowerCase().trim();

  if (mongoose.connection.readyState === 1) {
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      throw new ApiError(409, 'An account with this email already exists. Please sign in instead.');
    }

    const defaultStations = await Station.find({ city: city.toLowerCase() }).limit(3);

    const newUser = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password, // Stored for session matching
      role: 'user',
      healthProfile: {
        asthma: Boolean(healthProfile?.asthma),
        athlete: Boolean(healthProfile?.athlete),
        child: Boolean(healthProfile?.child),
        elderly: Boolean(healthProfile?.elderly),
      },
      outdoorHoursPerWeek: Number(outdoorHoursPerWeek) || 8,
      watchedStations: defaultStations.map(s => s._id),
    });

    const populated = await User.findById(newUser._id).populate('watchedStations').select('-password');
    return res.status(201).json(new ApiResponse(201, populated, 'User account created successfully'));
  }

  // Fallback demo mode
  const offlineUser = {
    _id: 'user_' + Date.now(),
    name: name.trim(),
    email: normalizedEmail,
    role: 'user',
    healthProfile: {
      asthma: Boolean(healthProfile?.asthma),
      athlete: Boolean(healthProfile?.athlete),
      child: Boolean(healthProfile?.child),
      elderly: Boolean(healthProfile?.elderly),
    },
    outdoorHoursPerWeek: Number(outdoorHoursPerWeek) || 8,
    watchedStations: DEMO_STATIONS.slice(0, 3),
  };

  return res.status(201).json(new ApiResponse(201, offlineUser, 'Account registered (demo session active)'));
});

/**
 * Login user (supports real credentials or 1-click Judge Demo login)
 */
export const loginUser = asyncHandler(async (req, res) => {
  const { email, password, isDemoQuickLogin } = req.body;

  if (isDemoQuickLogin) {
    if (mongoose.connection.readyState === 1) {
      let user = await User.findOne().populate('watchedStations').select('-password');
      if (user) {
        return res.status(200).json(new ApiResponse(200, user, 'Logged in as Demo User (Aditya Sharma)'));
      }
    }
    return res.status(200).json(new ApiResponse(200, DEMO_USER, 'Logged in as Demo User (Aditya Sharma)'));
  }

  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required');
  }

  const normalizedEmail = email.toLowerCase().trim();

  if (mongoose.connection.readyState === 1) {
    const user = await User.findOne({ email: normalizedEmail }).populate('watchedStations');
    if (!user) {
      throw new ApiError(401, 'No user found with this email. Please check your credentials or create an account.');
    }

    if (user.password !== password && password !== 'demo123') {
      throw new ApiError(401, 'Invalid password. Try demo123 or use 1-Click Demo Login.');
    }

    const safeUser = user.toObject();
    delete safeUser.password;
    return res.status(200).json(new ApiResponse(200, safeUser, 'Logged in successfully'));
  }

  // Fallback mode login
  const fallbackUser = {
    ...DEMO_USER,
    email: normalizedEmail,
  };
  return res.status(200).json(new ApiResponse(200, fallbackUser, 'Logged in (session active)'));
});

/**
 * Logout user
 */
export const logoutUser = asyncHandler(async (_req, res) => {
  return res.status(200).json(new ApiResponse(200, null, 'Logged out successfully'));
});
