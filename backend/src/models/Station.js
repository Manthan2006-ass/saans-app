import mongoose from 'mongoose';

/**
 * Station Schema
 * Monitoring station metadata for Pune & Delhi
 */
const stationSchema = new mongoose.Schema({
  openaqId: { type: Number, unique: true, sparse: true },
  name: { type: String, required: true },
  city: { type: String, required: true, index: true },
  state: { type: String, default: 'Maharashtra' },
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  // Convenience getters for backward compatibility
  lat: Number,
  lon: Number,
  provider: { type: String, default: 'CPCB / IITM' },
  sensors: { type: Map, of: String, default: {} },
  isActive: { type: Boolean, default: true },
  active: { type: Boolean, default: true },
  lastSuccessAt: Date,
  lastError: String,
}, { timestamps: true });

// Ensure location coordinates mirror lat/lon for legacy code compatibility
stationSchema.pre('save', function (next) {
  if (this.location && this.location.lat && this.location.lng) {
    this.lat = this.location.lat;
    this.lon = this.location.lng;
  } else if (this.lat && this.lon) {
    this.location = { lat: this.lat, lng: this.lon };
  }
  this.active = this.isActive;
  next();
});

export const Station = mongoose.model('Station', stationSchema);
export default Station;
