import mongoose from 'mongoose';

/**
 * Alert Schema
 * Manages personalized and environmental air quality alerts.
 */
const alertSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  station: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Station',
    required: true,
  },
  type: {
    type: String,
    enum: ['spike', 'threshold', 'inversion'],
    default: 'spike',
  },
  severity: {
    type: String,
    enum: ['low', 'moderate', 'high', 'hazardous'],
    default: 'moderate',
  },
  message: {
    type: String,
    required: true,
  },
  aqiValue: {
    type: Number,
    required: true,
  },
  isRead: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

export const Alert = mongoose.model('Alert', alertSchema);
export default Alert;
