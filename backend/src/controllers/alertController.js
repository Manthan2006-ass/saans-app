import mongoose from 'mongoose';
import { Alert } from '../models/Alert.js';
import { Station } from '../models/Station.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { DEMO_STATIONS } from '../services/demoData.js';

// High-fidelity fallback alerts for zero-downtime offline mode
const FALLBACK_ALERTS = [
  {
    _id: '671a5c68910243211e400010',
    station: DEMO_STATIONS[2], // Wakad
    type: 'spike',
    severity: 'high',
    message: 'Evening peak PM2.5 spike (AQI 242) detected along Wakad / Hinjewadi IT corridor.',
    aqiValue: 242,
    isRead: false,
    createdAt: new Date().toISOString(),
  },
  {
    _id: '671a5c68910243211e400011',
    station: DEMO_STATIONS[5], // Anand Vihar
    type: 'inversion',
    severity: 'hazardous',
    message: 'Severe night-time thermal boundary inversion trapping fine particulate matter (AQI 388).',
    aqiValue: 388,
    isRead: false,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    _id: '671a5c68910243211e400012',
    station: DEMO_STATIONS[1], // Shivajinagar
    type: 'threshold',
    severity: 'moderate',
    message: 'Sensors cross moderate threshold (AQI > 100). Asthma patients should carry preventative medication.',
    aqiValue: 128,
    isRead: true,
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
];

/**
 * Get all alerts with optional city & unread filtering
 */
export const getAlerts = asyncHandler(async (req, res) => {
  const { city, unreadOnly } = req.query;

  if (mongoose.connection.readyState === 1) {
    const filter = {};
    if (unreadOnly === 'true') filter.isRead = false;

    let alerts = await Alert.find(filter)
      .populate('station')
      .sort({ createdAt: -1 })
      .lean();

    if (city) {
      const targetCity = city.toLowerCase();
      alerts = alerts.filter(a => a.station?.city?.toLowerCase() === targetCity);
    }

    return res.status(200).json(new ApiResponse(200, alerts, 'Alerts retrieved successfully'));
  }

  // Fallback offline mode
  let filtered = [...FALLBACK_ALERTS];
  if (city) {
    const targetCity = city.toLowerCase();
    filtered = filtered.filter(a => a.station?.city?.toLowerCase() === targetCity);
  }
  if (unreadOnly === 'true') {
    filtered = filtered.filter(a => !a.isRead);
  }

  return res.status(200).json(new ApiResponse(200, filtered, 'Fallback alerts retrieved'));
});

/**
 * Mark an alert as read
 */
export const markAlertRead = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (mongoose.connection.readyState === 1) {
    if (!mongoose.isValidObjectId(id)) {
      throw new ApiError(400, 'Invalid alert ID format');
    }
    const alert = await Alert.findByIdAndUpdate(id, { isRead: true }, { new: true });
    if (!alert) throw new ApiError(404, 'Alert not found');
    return res.status(200).json(new ApiResponse(200, alert, 'Alert marked as read'));
  }

  const alert = FALLBACK_ALERTS.find(a => a._id === id);
  if (alert) alert.isRead = true;
  return res.status(200).json(new ApiResponse(200, alert || { _id: id, isRead: true }, 'Alert marked as read'));
});

/**
 * Create a new environmental or threshold alert
 */
export const createAlert = asyncHandler(async (req, res) => {
  const { stationId, type, severity, message, aqiValue, userId } = req.body;

  if (!stationId || !message || aqiValue === undefined) {
    throw new ApiError(400, 'Station, message, and aqiValue are required');
  }

  if (mongoose.connection.readyState === 1) {
    const station = await Station.findOne({
      $or: [{ _id: mongoose.isValidObjectId(stationId) ? stationId : null }, { openaqId: Number(stationId) }],
    });
    if (!station) throw new ApiError(404, 'Station not found');

    const alert = await Alert.create({
      user: userId || null,
      station: station._id,
      type: type || 'spike',
      severity: severity || 'moderate',
      message,
      aqiValue,
      isRead: false,
    });

    const populated = await Alert.findById(alert._id).populate('station');
    return res.status(201).json(new ApiResponse(201, populated, 'Alert created successfully'));
  }

  const newFallbackAlert = {
    _id: 'alert_' + Date.now(),
    station: DEMO_STATIONS.find(s => s.openaqId === Number(stationId)) || DEMO_STATIONS[0],
    type: type || 'spike',
    severity: severity || 'moderate',
    message,
    aqiValue,
    isRead: false,
    createdAt: new Date().toISOString(),
  };
  FALLBACK_ALERTS.unshift(newFallbackAlert);
  return res.status(201).json(new ApiResponse(201, newFallbackAlert, 'Alert created (fallback mode)'));
});
