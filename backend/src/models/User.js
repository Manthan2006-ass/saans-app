import mongoose from 'mongoose';

/**
 * User Schema
 * Manages user accounts, personalized health personas, and watched stations.
 */
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  healthProfile: {
    asthma: { type: Boolean, default: false },
    athlete: { type: Boolean, default: false },
    child: { type: Boolean, default: false },
    elderly: { type: Boolean, default: false },
  },
  outdoorHoursPerWeek: { type: Number, default: 5 },
  watchedStations: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Station',
    },
  ],
}, { timestamps: true });

export const User = mongoose.model('User', userSchema);
export default User;
