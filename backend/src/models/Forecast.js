import mongoose from 'mongoose';

/**
 * Forecast Schema
 * 72-hour forecast curve with confidence bands & embedded SHAP feature drivers
 */
const forecastHourSchema = new mongoose.Schema({
  time: { type: Date, required: true },
  aqi: { type: Number, required: true },
  lower: { type: Number, required: true },
  upper: { type: Number, required: true },
  pm25: Number,
  pm10: Number,
}, { _id: false });

const forecastDriverSchema = new mongoose.Schema({
  feature: { type: String, required: true }, // e.g., 'Wind Speed', 'Vehicular NO2', 'Thermal Inversion'
  impact: { type: Number, required: true },  // e.g., +24 or -18 (SHAP contribution score)
  direction: { type: String, enum: ['increases_aqi', 'decreases_aqi', 'neutral'], required: true },
  description: String,
}, { _id: false });

const forecastSchema = new mongoose.Schema({
  station: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Station',
    required: true,
  },
  stationId: Number, // OpenAQ/numeric identifier
  generatedAt: { type: Date, default: Date.now },
  modelVersion: { type: String, default: 'LightGBM-v2.1' },
  hours: [forecastHourSchema],
  drivers: [forecastDriverSchema],
}, { timestamps: true });

forecastSchema.index({ station: 1, generatedAt: -1 });

export const Forecast = mongoose.model('Forecast', forecastSchema);
export default Forecast;

