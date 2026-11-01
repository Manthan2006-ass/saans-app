import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cron from 'node-cron';

import { app } from './app.js';
import { connectDB } from './db/index.js';
import { DB_NAME, DEFAULT_PORT } from './constants.js';
import { Station } from './models/Station.js';
import { Reading } from './models/Reading.js';
import { User } from './models/User.js';
import { Alert } from './models/Alert.js';
import { ingestStationDualSource } from './services/liveIngest.js';
import { DEMO_STATIONS, generateDemoReadings } from './services/demoData.js';
import { seedAdminUser } from './controllers/adminController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let running = false;
let lastIngestSummary = null;

// ────────────────────────────────────────────────
// STATION SEEDING
// ────────────────────────────────────────────────

function parseCsvLine(line) {
  const out = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"' && quoted) {
      value += '"';
      i++;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      out.push(value);
      value = '';
    } else {
      value += ch;
    }
  }
  out.push(value);
  return out;
}

function loadUsableStationsFromCsv() {
  const candidateCsvPaths = [
    process.env.COVERAGE_CSV,
    path.resolve(__dirname, '../../reports/coverage_report.csv'),
    path.resolve(__dirname, '../../../reports/coverage_report.csv'),
    path.resolve(process.cwd(), 'reports/coverage_report.csv'),
  ].filter(Boolean);

  for (const csvPath of candidateCsvPaths) {
    if (fs.existsSync(csvPath)) {
      try {
        const lines = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '').trim().split(/\r?\n/);
        const headers = parseCsvLine(lines.shift());
        const rows = lines.map(line => Object.fromEntries(parseCsvLine(line).map((v, i) => [headers[i], v])));
        const seen = new Set();
        return rows
          .filter(r => r.USABLE?.toLowerCase() === 'true')
          .filter(r => {
            const key = r.city + ':' + r.location_id;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .map(r => ({
            openaqId: Number(r.location_id),
            city: r.city,
            name: r.name,
            lat: Number(r.lat),
            lon: Number(r.lon),
            provider: r.provider,
            active: true,
          }))
          .filter(s => Number.isFinite(s.openaqId));
      } catch {
        // Fall through
      }
    }
  }
  return [];
}

async function seedStations() {
  let stationsToSeed = DEMO_STATIONS.map(s => ({
    openaqId: s.openaqId,
    city: s.city,
    state: s.state || (s.city === 'delhi' ? 'Delhi' : 'Maharashtra'),
    name: s.name,
    location: s.location || { lat: s.lat, lng: s.lon },
    lat: s.lat,
    lon: s.lon,
    provider: s.provider,
    isActive: true,
    active: true,
  }));

  for (const item of stationsToSeed) {
    await Station.updateOne(
      { openaqId: item.openaqId },
      { $set: { ...item, lastError: null } },
      { upsert: true }
    );
  }
  console.log(`✓ Seeded ${stationsToSeed.length} monitoring station(s) into MongoDB.`);

  // Seed baseline dataset readings for each station if empty
  const allStations = await Station.find({ isActive: true });
  for (const st of allStations) {
    const readingCount = await Reading.countDocuments({
      $or: [{ station: st._id }, { stationId: st.openaqId }],
    });
    if (readingCount === 0) {
      const generated = generateDemoReadings(st.openaqId, st._id);
      await Reading.insertMany(generated);
      console.log(`✓ Seeded ${generated.length} dataset readings for station: ${st.name}`);
    }
  }

  // Seed default demo user with healthProfile
  const userCount = await User.countDocuments();
  let defaultUser = null;
  if (userCount === 0) {
    const puneStations = allStations.filter(s => s.city === 'pune').map(s => s._id);
    defaultUser = await User.create({
      name: 'Aditya Sharma',
      email: 'aditya@saans.org',
      password: 'hashed_demo_password_123',
      role: 'user',
      healthProfile: {
        asthma: true,
        athlete: false,
        child: false,
        elderly: false,
      },
      outdoorHoursPerWeek: 8,
      watchedStations: puneStations.slice(0, 3),
    });
    console.log(`✓ Seeded default health-profile user: ${defaultUser.name} (${defaultUser.email})`);
  } else {
    defaultUser = await User.findOne();
  }

  // Seed sample environmental alerts if empty
  const alertCount = await Alert.countDocuments();
  if (alertCount === 0 && allStations.length > 0) {
    const wakad = allStations.find(s => s.name.includes('Wakad')) || allStations[0];
    const anandVihar = allStations.find(s => s.city === 'delhi') || allStations[1];

    await Alert.create([
      {
        user: defaultUser?._id,
        station: wakad._id,
        type: 'spike',
        severity: 'high',
        message: 'Rush hour PM2.5 spike detected near Wakad / Hinjewadi IT corridor.',
        aqiValue: 242,
        isRead: false,
      },
      {
        user: defaultUser?._id,
        station: anandVihar._id,
        type: 'inversion',
        severity: 'hazardous',
        message: 'Severe night-time thermal boundary inversion trapping PM10 & PM2.5 particulates.',
        aqiValue: 388,
        isRead: false,
      },
      {
        user: defaultUser?._id,
        station: wakad._id,
        type: 'threshold',
        severity: 'moderate',
        message: 'Sensors cross moderate threshold (AQI > 100). Sensitive groups should reduce strenuous outdoor activity.',
        aqiValue: 124,
        isRead: true,
      },
    ]);
    console.log(`✓ Seeded sample spike, inversion, and threshold alerts.`);
  }
}

// ────────────────────────────────────────────────
// DUAL-SOURCE INGESTION
// ────────────────────────────────────────────────

async function runIngest() {
  if (running) return;
  running = true;

  const apiKey =
    process.env.OPENAQ_API_KEY && process.env.OPENAQ_API_KEY !== 'PASTE_YOUR_KEY_HERE'
      ? process.env.OPENAQ_API_KEY.trim()
      : null;

  const summary = { openaq: 0, openMeteo: 0, failed: 0, totalReadings: 0 };

  try {
    const stations = await Station.find({ active: true });
    for (const st of stations) {
      try {
        const result = await ingestStationDualSource(st, apiKey, Reading, Station);
        if (result.openaqSuccess) summary.openaq++;
        else summary.openMeteo++;
        summary.totalReadings += result.readingsStored;
      } catch (err) {
        summary.failed++;
        await Station.updateOne({ _id: st._id }, { $set: { lastError: err.message } });
      }
    }
    const totalInDb = await Reading.countDocuments();
    lastIngestSummary = { ...summary, totalInDb, timestamp: new Date() };
    console.log(
      `[SAANS Live Sync] ✓ OpenAQ: ${summary.openaq} stations | Open-Meteo fallback: ${summary.openMeteo} | Failed: ${summary.failed} | New readings: ${summary.totalReadings} | Total in MongoDB: ${totalInDb}`
    );
  } catch (err) {
    console.error('[Ingest Exception]:', err.message);
  } finally {
    running = false;
  }
}

// ────────────────────────────────────────────────
// SERVER BOOTSTRAP
// ────────────────────────────────────────────────

const port = Number(process.env.PORT) || DEFAULT_PORT;
const mongoUri = process.env.MONGODB_URI || `mongodb://127.0.0.1:27017/${DB_NAME}`;
const hasOpenAQ = Boolean(
  process.env.OPENAQ_API_KEY &&
  process.env.OPENAQ_API_KEY.trim() &&
  process.env.OPENAQ_API_KEY !== 'PASTE_YOUR_KEY_HERE'
);

connectDB(mongoUri)
  .then(async () => {
    await Reading.syncIndexes().catch(() => {});
    await Station.syncIndexes().catch(() => {});
    await seedStations().catch(err => console.warn('Station seed warning:', err.message));
    await seedAdminUser().catch(err => console.warn('Admin seed warning:', err.message));

    app.listen(port, () => {
      console.log(`\n╔═══════════════════════════════════════════════════════╗`);
      console.log(`║  SAANS 2.0 Backend (Standard Architecture)            ║`);
      console.log(`║  Server:  http://localhost:${port}                       ║`);
      console.log(`║  MongoDB: ✓ CONNECTED                                 ║`);
      console.log(`║  OpenAQ:  ${hasOpenAQ ? '✓ LIVE (Ground Station Data)' : '✗ No key in .env'}             ║`);
      console.log(`║  Meteo:   ✓ ACTIVE (Satellite Fallback)               ║`);
      console.log(`╚═══════════════════════════════════════════════════════╝\n`);
    });

    // Run initial live ingest asynchronously
    console.log(`Fetching live observations...`);
    console.log(`  Primary: ${hasOpenAQ ? 'OpenAQ v3 (CPCB Ground Data)' : 'Add OPENAQ_API_KEY to .env'}`);
    console.log(`  Fallback: Open-Meteo Air Quality (Satellite)\n`);
    runIngest().catch(e => console.error('[Ingest Error]:', e.message));

    // Scheduled cron ingestion
    cron.schedule('10 * * * *', async () => {
      console.log('\n[Cron] Refreshing live hourly air telemetry...');
      await runIngest();
    });
  })
  .catch((err) => {
    console.warn('\n⚠️ MongoDB unavailable, starting in bulletproof fallback mode:', err.message);
    app.listen(port, () => console.log(`SAANS listening on port ${port} (Fallback Mode)`));
  });

export { app, lastIngestSummary };
