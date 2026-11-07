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
  const idNum = Number(stationId);
  const isDelhi = idNum >= 7000;
  const now = Date.now();
  const currentHour = Math.floor(now / 3600000) * 3600000;
  const readings = [];

  // Distinct microclimate baseline and offsets per station
  let basePM25 = 48;
  let tempOffset = 0;
  let humOffset = 0;
  let windOffset = 0;

  if (idNum === 11610) {
    // Nigdi / Akurdi (PCCOE Vicinity) — suburban plateau
    basePM25 = 52;
    tempOffset = 0.5;
    humOffset = 2;
    windOffset = 1.2;
  } else if (idNum === 11613) {
    // Shivajinagar — central urban river basin
    basePM25 = 62;
    tempOffset = 1.8;
    humOffset = -4;
    windOffset = -1.6;
  } else if (idNum === 3409436) {
    // Wakad / Hinjewadi IT Corridor — breezy westerly bypass
    basePM25 = 26;
    tempOffset = -0.6;
    humOffset = 4;
    windOffset = 3.2;
  } else if (idNum === 3409331) {
    // Bhosari Industrial Area — heavy particulate & thermal trap
    basePM25 = 78;
    tempOffset = 2.4;
    humOffset = -7;
    windOffset = -2.4;
  } else if (idNum === 3409438) {
    // Katraj Dairy — southern hillside buffer
    basePM25 = 38;
    tempOffset = -2.1;
    humOffset = 8;
    windOffset = 0.6;
  } else if (isDelhi) {
    basePM25 = idNum === 7001 ? 138 : (idNum === 7002 ? 112 : 94);
    tempOffset = -4.0;
    humOffset = -12;
    windOffset = -3.5;
  }

  // Generate 7 full days of historical readings (168 hours)
  for (let offset = 167; offset >= 0; offset--) {
    const timestamp = new Date(currentHour - offset * 3600000);
    const hour = timestamp.getHours();

    // Diurnal variation: morning traffic/inversion spike (7-10 AM) and evening stagnation (7-10 PM)
    let diurnalFactor = 1.0;
    if (hour >= 7 && hour <= 10) diurnalFactor = 1.38;
    else if (hour >= 12 && hour <= 15) diurnalFactor = 0.72;
    else if (hour >= 19 && hour <= 22) diurnalFactor = 1.32;

    const noise = Math.sin(offset * 0.4) * 4 + Math.cos(offset * 0.15) * 3;
    const pm25 = Math.max(12, Math.round(basePM25 * diurnalFactor + noise));
    const pm10 = Math.round(pm25 * 1.78 + Math.sin(offset) * 6);
    const no2 = Math.max(14, Math.round(pm25 * 0.44 + (hour >= 8 && hour <= 11 ? 14 : 0) + (tempOffset > 1 ? 6 : 0)));
    // Ground ozone: secondary photochemical pollutant peaking at midday, never zero
    const o3 = Math.max(18, Math.round(32 + Math.sin((hour - 10) / 4) * 14 + (isDelhi ? 8 : 0)));
    const so2 = Math.max(6, Math.round(pm25 * 0.16 + (idNum === 3409331 ? 8 : 0)));
    const co = +(Math.max(0.3, pm25 * 0.012)).toFixed(2);

    // Weather metrics with station-specific microclimate variation
    const temperature = +(24 + tempOffset + Math.sin((hour - 8) / 4) * 5.8).toFixed(1);
    const humidity = Math.min(92, Math.max(28, Math.round(58 + humOffset - (temperature - 24) * 2.8)));
    const windSpeed = +(Math.max(2.4, 9.6 + windOffset + Math.cos(hour / 3) * 3.6)).toFixed(1);
    const visibility = +(Math.max(1.2, (10 - (pm25 / 45)))).toFixed(1);

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
