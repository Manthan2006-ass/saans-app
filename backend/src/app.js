import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import stationRoutes from './routes/stationRoutes.js';
import forecastRoutes from './routes/forecastRoutes.js';
import accountabilityRoutes from './routes/accountabilityRoutes.js';
import userRoutes from './routes/userRoutes.js';
import alertRoutes from './routes/alertRoutes.js';
import storeRoutes from './routes/storeRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import commuteRoutes from './routes/commuteRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { getStationForecast, compareDepartureTimes, getSpikeAlerts } from './controllers/forecastController.js';
import { errorHandler } from './middlewares/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Standard express parsers
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: true, limit: '16kb' }));

// Public static files
const rootPublicDir = path.resolve(__dirname, '../../public');
if (fs.existsSync(rootPublicDir)) {
  app.use(express.static(rootPublicDir));
}

const backendPublicTemp = path.resolve(__dirname, '../public/temp');
if (fs.existsSync(backendPublicTemp)) {
  app.use('/temp', express.static(backendPublicTemp));
}

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'SAANS 2.0 Backend (Standard Production Architecture)',
    liveApiSource: process.env.LIVE_API_SOURCE || 'openaq+open-meteo',
    timestamp: new Date().toISOString(),
  });
});

// Modular Routers
app.use('/api/stations', stationRoutes);
app.use('/api/forecast', forecastRoutes);
app.use('/api/accountability', accountabilityRoutes);
app.use('/api/user', userRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/commute', commuteRoutes);
app.use('/api/admin', adminRoutes);

// Convenience & backward-compatible aliases
app.get('/api/stations/:id/forecast', getStationForecast);
app.post('/api/planner/compare', compareDepartureTimes);
app.get('/api/alerts/spikes', getSpikeAlerts);

// Global Error Handler Middleware
app.use(errorHandler);

export { app };
export default app;
