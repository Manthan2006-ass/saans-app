import { forecastForStation } from './forecast.js';

/**
 * CPCB Indian National Air Quality Index (AQI) Calculation
 */
export function calculateCpcbAqi(pm25, pm10) {
  function getSubIndex(val, breakpoints, indexPoints) {
    if (val === null || val === undefined || isNaN(val)) return 0;
    for (let i = 0; i < breakpoints.length - 1; i++) {
      if (val >= breakpoints[i] && val <= breakpoints[i + 1]) {
        return Math.round(
          ((indexPoints[i + 1] - indexPoints[i]) / (breakpoints[i + 1] - breakpoints[i])) *
            (val - breakpoints[i]) +
            indexPoints[i]
        );
      }
    }
    return 500;
  }

  const pm25B = [0, 30, 60, 90, 120, 250, 500];
  const pm10B = [0, 50, 100, 250, 350, 430, 600];
  const idx = [0, 50, 100, 200, 300, 400, 500];

  const pm25Idx = getSubIndex(pm25, pm25B, idx);
  const pm10Idx = getSubIndex(pm10, pm10B, idx);

  const aqi = Math.max(pm25Idx, pm10Idx);
  const dominantPollutant = pm25Idx >= pm10Idx ? 'PM2.5' : 'PM10';
  return { aqi, dominantPollutant };
}

/**
 * Core monitoring stations for Pune & Delhi from verified CPCB/IITM/MPCB datasets
 */
export const DEMO_STATIONS = [
  // Pune Stations
  {
    openaqId: 11610,
    city: 'pune',
    state: 'Maharashtra',
    name: 'Nigdi / Akurdi (PCCOE Vicinity), Pune',
    location: { lat: 18.664282, lng: 73.763966 },
    lat: 18.664282,
    lon: 73.763966,
    provider: 'CPCB / IITM',
    isActive: true,
    active: true,
  },
  {
    openaqId: 11613,
    city: 'pune',
    state: 'Maharashtra',
    name: 'Shivajinagar, Pune - IITM',
    location: { lat: 18.530085, lng: 73.849598 },
    lat: 18.530085,
    lon: 73.849598,
    provider: 'CPCB / IITM',
    isActive: true,
    active: true,
  },
  {
    openaqId: 3409436,
    city: 'pune',
    state: 'Maharashtra',
    name: 'Wakad / Hinjewadi IT Corridor - MPCB',
    location: { lat: 18.59051, lng: 73.77946 },
    lat: 18.59051,
    lon: 73.77946,
    provider: 'CPCB / MPCB',
    isActive: true,
    active: true,
  },
  {
    openaqId: 3409331,
    city: 'pune',
    state: 'Maharashtra',
    name: 'Bhosari Industrial Area, PCMC - IITM',
    location: { lat: 18.640051, lng: 73.848956 },
    lat: 18.640051,
    lon: 73.848956,
    provider: 'CPCB / IITM',
    isActive: true,
    active: true,
  },
  {
    openaqId: 3409438,
    city: 'pune',
    state: 'Maharashtra',
    name: 'Katraj Dairy, Pune - MPCB',
    location: { lat: 18.45445, lng: 73.854155 },
    lat: 18.45445,
    lon: 73.854155,
    provider: 'CPCB / MPCB',
    isActive: true,
    active: true,
  },

  // Delhi Stations
  {
    openaqId: 7001,
    city: 'delhi',
    state: 'Delhi',
    name: 'Anand Vihar, Delhi - DPCC',
    location: { lat: 28.6476, lng: 77.3158 },
    lat: 28.6476,
    lon: 77.3158,
    provider: 'DPCC',
    isActive: true,
    active: true,
  },
  {
    openaqId: 7002,
    city: 'delhi',
    state: 'Delhi',
    name: 'ITO, Central Delhi - CPCB',
    location: { lat: 28.6289, lng: 77.241 },
    lat: 28.6289,
    lon: 77.241,
    provider: 'CPCB',
    isActive: true,
    active: true,
  },
  {
    openaqId: 7003,
    city: 'delhi',
    state: 'Delhi',
    name: 'RK Puram, South Delhi - DPCC',
    location: { lat: 28.5632, lng: 77.1869 },
    lat: 28.5632,
    lon: 77.1869,
    provider: 'DPCC',
    isActive: true,
    active: true,
  },
  {
    openaqId: 7004,
    city: 'delhi',
    state: 'Delhi',
    name: 'Punjabi Bagh, West Delhi - DPCC',
    location: { lat: 28.674, lng: 77.131 },
    lat: 28.674,
    lon: 77.131,
    provider: 'DPCC',
    isActive: true,
    active: true,
  },
  {
    openaqId: 7005,
    city: 'delhi',
    state: 'Delhi',
    name: 'Mandir Marg, Central Delhi - DPCC',
    location: { lat: 28.636, lng: 77.201 },
    lat: 28.636,
    lon: 77.201,
    provider: 'DPCC',
    isActive: true,
    active: true,
  },
];

/**
 * Generates continuous 96 hours of hourly time-series readings with realistic diurnal smog dynamics
 * Matching the exact fields of Reading schema:
 * station, aqi, pm25, pm10, no2, o3, temperature, humidity, windSpeed, visibility, dominantPollutant, timestamp
 */
export function generateDemoReadings(stationId, stationObjectId = null) {
  const isDelhi = Number(stationId) >= 7000;
  const basePM25 = isDelhi ? 95 : (Number(stationId) === 3409331 ? 68 : 46);
  const now = Date.now();
  const currentHour = Math.floor(now / 3600000) * 3600000;
  const readings = [];

  for (let offset = 95; offset >= 0; offset--) {
    const timestamp = new Date(currentHour - offset * 3600000);
    const hour = timestamp.getHours();

    // Diurnal variation: morning traffic/inversion spike (7-9 AM) and night accumulation (8-10 PM)
    let diurnalFactor = 1.0;
    if (hour >= 7 && hour <= 10) diurnalFactor = 1.45;
    else if (hour >= 13 && hour <= 16) diurnalFactor = 0.75;
    else if (hour >= 20 && hour <= 23) diurnalFactor = 1.35;

    const noise = Math.sin(offset * 0.4) * 6 + Math.cos(offset * 0.15) * 4;
    const pm25 = Math.max(12, Math.round(basePM25 * diurnalFactor + noise));
    const pm10 = Math.round(pm25 * 1.82 + Math.sin(offset) * 8);
    const no2 = Math.round(pm25 * 0.52 + (hour >= 8 && hour <= 11 ? 15 : 0));
    const o3 = Math.max(10, Math.round(52 - diurnalFactor * 14));
    const so2 = Math.round(pm25 * 0.18);
    const co = +(pm25 * 0.014).toFixed(2);

    // Weather metrics
    const temperature = +(24 + Math.sin((hour - 8) / 4) * 6).toFixed(1);
    const humidity = Math.min(95, Math.max(30, Math.round(65 - (temperature - 24) * 3)));
    const windSpeed = +(8 + Math.cos(hour / 3) * 4).toFixed(1);
    const visibility = +(Math.max(1.5, (10 - (pm25 / 40)))).toFixed(1);

    const { aqi, dominantPollutant } = calculateCpcbAqi(pm25, pm10);

    readings.push({
      station: stationObjectId,
      stationId: Number(stationId),
      aqi,
      pm25,
      pm10,
      no2,
      so2,
      co,
      o3,
      temperature,
      humidity,
      windSpeed,
      visibility,
      dominantPollutant,
      timestamp,
      ts: timestamp,
      source: 'dataset',
    });
  }
  return readings;
}

export function getDemoStationsWithLatest(city) {
  const filterCity = (city || 'pune').toLowerCase();
  const filtered = DEMO_STATIONS.filter(s => s.city === filterCity);
  return filtered.map(station => {
    const readings = generateDemoReadings(station.openaqId);
    const latestReading = readings[readings.length - 1];
    return {
      ...station,
      latestReading,
    };
  });
}

export function getDemoForecast(stationId) {
  const station = DEMO_STATIONS.find(s => s.openaqId === Number(stationId));
  if (!station) return null;
  const readings = generateDemoReadings(station.openaqId);
  return forecastForStation(station, readings);
}
