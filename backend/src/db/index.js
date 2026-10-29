import mongoose from 'mongoose';
import { DB_NAME } from '../constants.js';

/**
 * Connect to MongoDB with connection pooling and timeout handling
 */
export async function connectDB(uri) {
  const targetUri = uri || process.env.MONGODB_URI || `mongodb://127.0.0.1:27017/${DB_NAME}`;
  try {
    console.log(`Connecting to MongoDB at: ${targetUri}...`);
    const conn = await mongoose.connect(targetUri, { serverSelectionTimeoutMS: 3000 });
    console.log(`✓ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (err) {
    console.warn(`⚠️ MongoDB connection error: ${err.message}`);
    throw err;
  }
}

export default connectDB;
