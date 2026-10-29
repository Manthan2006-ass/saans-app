import mongoose from 'mongoose';

/**
 * Reading Schema
 * Stores environmental & pollutant telemetry for each station.
 */
const readingSchema = new mongoose.Schema({
  station: { type: mongoose.Schema.Types.ObjectId, ref: 'Station' },
  stationId: { type: Number, index: true }, // OpenAQ/numeric station ID
  aqi: { type: Number, index: true },
  pm25: Number,
  pm10: Number,
  no2: Number,
  so2: Number,
  co: Number,
  o3: Number,
  temperature: Number,
  humidity: Number,
  windSpeed: Number,
  visibility: Number,
  dominantPollutant: { type: String, default: 'PM2.5' },
  timestamp: { type: Date, default: Date.now, index: true },
  ts: { type: Date, index: true }, // Legacy alias for timestamp
  source: { type: String, default: 'dataset' },
}, { timestamps: true });

// Sync timestamp and ts for legacy query compatibility
readingSchema.pre('save', function (next) {
  if (this.timestamp && !this.ts) {
    this.ts = this.timestamp;
  } else if (this.ts && !this.timestamp) {
    this.timestamp = this.ts;
  }
  next();
});

readingSchema.index({ stationId: 1, ts: 1 });
readingSchema.index({ station: 1, timestamp: -1 });

export const Reading = mongoose.model('Reading', readingSchema);
export default Reading;
