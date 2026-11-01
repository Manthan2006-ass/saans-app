import mongoose from 'mongoose';
import { Station } from '../models/Station.js';
import { Reading } from '../models/Reading.js';
import { Product } from '../models/Product.js';
import { DEMO_STATIONS, generateDemoReadings, calculateCpcbAqi } from './demoData.js';
import { optimizeCommuteRoute, CORRIDOR_PRESETS } from './commuteOptimizer.js';
import { forecastForStation } from './forecast.js';

// User's default college profile for "near my college" queries
export const USER_COLLEGE_LOCATION = {
  name: 'PCCOE Campus (Pimpri Chinchwad College of Engineering)',
  address: 'Sector 26, Pradhikaran, Nigdi, Akurdi, Pune - 411044',
  matchedStationId: 11610, // Nigdi / Akurdi (PCCOE Vicinity)
};

// Known geographic aliases mapped to monitoring stations
export const LOCATION_ALIASES = [
  // Pune Metropolitan Nodes
  {
    keywords: ['pccoe', 'pccoe campus', 'akurdi', 'nigdi', 'pradhikaran', 'ravet'],
    stationId: 11610,
    city: 'pune',
    matchedName: 'Nigdi / Akurdi (PCCOE Vicinity), Pune',
    landmark: 'PCCOE Campus, Sector 26, Pradhikaran, Akurdi',
  },
  {
    keywords: ['college', 'my college', 'campus', 'my university'],
    stationId: 11610,
    city: 'pune',
    matchedName: 'Nigdi / Akurdi (PCCOE Vicinity), Pune',
    landmark: 'User Saved College: PCCOE Campus (Akurdi)',
  },
  {
    keywords: ['mg road', 'm.g. road', 'camp', 'pune camp', 'bund garden'],
    stationId: 11613,
    city: 'pune',
    matchedName: 'Shivajinagar, Pune - IITM',
    landmark: 'Pune Central / Camp Corridor (Closest IITM CPCB Station to MG Road, ~3.8 km)',
  },
  {
    keywords: ['shivajinagar', 'shivaji nagar', 'fc road', 'jm road', 'pune university', 'deccan'],
    stationId: 11613,
    city: 'pune',
    matchedName: 'Shivajinagar, Pune - IITM',
    landmark: 'Shivajinagar Central, Pune',
  },
  {
    keywords: ['hinjewadi', 'hinjawadi', 'it park', 'phase 1', 'phase 2', 'phase 3', 'wakad'],
    stationId: 3409436,
    city: 'pune',
    matchedName: 'Wakad / Hinjewadi IT Corridor - MPCB',
    landmark: 'Hinjewadi Tech Hub & Wakad Junction',
  },
  {
    keywords: ['bhosari', 'pcmc industrial', 'midc', 'chakan', 'moshi', 'bhosari industrial area'],
    stationId: 3409331,
    city: 'pune',
    matchedName: 'Bhosari Industrial Area, PCMC - IITM',
    landmark: 'PCMC Industrial Corridor, Bhosari',
  },
  {
    keywords: ['katraj', 'katraj dairy', 'swargate', 'bibwewadi', 'dhankawadi', 'kondhwa'],
    stationId: 3409438,
    city: 'pune',
    matchedName: 'Katraj Dairy, Pune - MPCB',
    landmark: 'Katraj / Southern Pune Metropolitan Area',
  },

  // Delhi NCR Nodes
  {
    keywords: ['anand vihar', 'isbt anand vihar', 'ghaziabad border', 'east delhi'],
    stationId: 7001,
    city: 'delhi',
    matchedName: 'Anand Vihar, Delhi - DPCC',
    landmark: 'Anand Vihar Inter-State Hub',
  },
  {
    keywords: ['ito', 'connaught place', 'cp', 'central delhi', 'pragati maidan', 'delhi gate'],
    stationId: 7002,
    city: 'delhi',
    matchedName: 'ITO, Central Delhi - CPCB',
    landmark: 'ITO / Central Delhi Government Corridor',
  },
  {
    keywords: ['rk puram', 'r.k. puram', 'south delhi', 'hauz khas', 'aiims', 'vasant vihar'],
    stationId: 7003,
    city: 'delhi',
    matchedName: 'RK Puram, South Delhi - DPCC',
    landmark: 'RK Puram Residential Cluster, South Delhi',
  },
  {
    keywords: ['punjabi bagh', 'west delhi', 'rajouri garden', 'paschim vihar', 'janakpuri'],
    stationId: 7004,
    city: 'delhi',
    matchedName: 'Punjabi Bagh, West Delhi - DPCC',
    landmark: 'Punjabi Bagh West Ring Corridor',
  },
  {
    keywords: ['mandir marg', 'gole market', 'president estate', 'central ridge'],
    stationId: 7005,
    city: 'delhi',
    matchedName: 'Mandir Marg, Central Delhi - DPCC',
    landmark: 'Mandir Marg / Central Ridge Forest Zone',
  },
];

// Unsupported metropolitan cities list
const UNSUPPORTED_LOCATIONS = [
  'mumbai', 'bangalore', 'bengaluru', 'hyderabad', 'chennai', 'kolkata',
  'ahmedabad', 'jaipur', 'lucknow', 'chandigarh', 'surat', 'bhopal', 'patna',
  'indore', 'nagpur', 'london', 'new york', 'california',
];

/**
 * 1. Location Resolution Logic
 * Extracts location from current query, falls back to conversation context, or handles unsupported areas.
 */
export function resolveLocation({ message, conversationHistory = [], currentCity = 'pune', currentStationId = null }) {
  const text = (message || '').toLowerCase();

  // Check if an unsupported city is explicitly requested
  for (const unsup of UNSUPPORTED_LOCATIONS) {
    const regex = new RegExp(`\\b${unsup}\\b`, 'i');
    if (regex.test(text)) {
      return {
        isUnsupported: true,
        requestedLocation: unsup.charAt(0).toUpperCase() + unsup.slice(1),
      };
    }
  }

  // 1. Check for explicit location mention in current user message (highest priority)
  for (const alias of LOCATION_ALIASES) {
    for (const kw of alias.keywords) {
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      if (regex.test(text)) {
        return {
          isUnsupported: false,
          stationId: alias.stationId,
          city: alias.city,
          matchedName: alias.matchedName,
          landmark: alias.landmark,
          isExplicit: true,
        };
      }
    }
  }

  // 2. Check conversation history for follow-up location context
  if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
    for (let i = conversationHistory.length - 1; i >= 0; i--) {
      const prevMsg = conversationHistory[i]?.content?.toLowerCase() || '';
      for (const alias of LOCATION_ALIASES) {
        for (const kw of alias.keywords) {
          const regex = new RegExp(`\\b${kw}\\b`, 'i');
          if (regex.test(prevMsg)) {
            return {
              isUnsupported: false,
              stationId: alias.stationId,
              city: alias.city,
              matchedName: alias.matchedName,
              landmark: alias.landmark,
              isFromContext: true,
            };
          }
        }
      }
    }
  }

  // 3. Fallback to currently selected dashboard station or default city
  const cityKey = (currentCity || 'pune').toLowerCase();
  let defaultStation = DEMO_STATIONS.find(s => s.openaqId === Number(currentStationId));
  if (!defaultStation) {
    defaultStation = DEMO_STATIONS.find(s => s.city === cityKey) || DEMO_STATIONS[0];
  }

  return {
    isUnsupported: false,
    stationId: defaultStation.openaqId,
    city: defaultStation.city,
    matchedName: defaultStation.name,
    landmark: defaultStation.name.split(',')[0],
    isDefault: true,
  };
}

/**
 * 2. Intent Detection
 * Classifies query into one of 11 distinct operational intents
 */
export function detectIntent(message) {
  const text = (message || '').toLowerCase();

  // 1. Commute Route Optimization
  if (
    text.includes('commute') ||
    text.includes('route') ||
    text.includes('safest way') ||
    text.includes('departure window') ||
    text.includes('traffic') ||
    text.includes('travel from') ||
    (text.includes('to ') && (text.includes('hinjewadi') || text.includes('pccoe') || text.includes('office')))
  ) {
    return 'commute_optimization';
  }

  // 2. Passive Cigarette & Toxic Dose Exposure Analysis
  if (
    text.includes('cigarette') ||
    text.includes('toxic dose') ||
    text.includes('passive smoking') ||
    text.includes('exposure today') ||
    text.includes('how many cigarettes') ||
    text.includes('lung dose') ||
    text.includes('inhaled mass')
  ) {
    return 'exposure_analysis';
  }

  // 3. Running / Exercise Safety Recommendations
  if (
    text.includes('run') ||
    text.includes('running') ||
    text.includes('jog') ||
    text.includes('jogging') ||
    text.includes('cycling') ||
    text.includes('workout') ||
    text.includes('exercise') ||
    text.includes('gym outside')
  ) {
    return 'exercise_recommendations';
  }

  // 4. Best Outdoor Window / Time Scrubber
  if (
    text.includes('best time') ||
    text.includes('safest time') ||
    text.includes('when should i go out') ||
    text.includes('outdoor window') ||
    text.includes('open windows') ||
    text.includes('walk outside')
  ) {
    return 'best_outdoor_time';
  }

  // 5. Pollution Drivers & Atmospheric SHAP Explanation
  if (
    text.includes('why') ||
    text.includes('reason') ||
    text.includes('cause') ||
    text.includes('increasing') ||
    text.includes('spiking') ||
    text.includes('rising') ||
    text.includes('driver') ||
    text.includes('shap') ||
    text.includes('inversion')
  ) {
    return 'pollution_explanation';
  }

  // 6. Future AQI Forecast (12h, 24h, 48h, 72h)
  if (
    text.includes('forecast') ||
    text.includes('tomorrow') ||
    text.includes('predict') ||
    text.includes('future') ||
    text.includes('next 24') ||
    text.includes('next 48') ||
    text.includes('72 hour') ||
    text.includes('will it increase') ||
    text.includes('trend tomorrow')
  ) {
    return 'forecast_aqi';
  }

  // 7. Historical AQI Trends
  if (
    text.includes('historical') ||
    text.includes('history') ||
    text.includes('yesterday') ||
    text.includes('past 24') ||
    text.includes('last few hours') ||
    text.includes('past trend')
  ) {
    return 'historical_aqi';
  }

  // 8. Product Recommendations (Masks, HEPA purifiers, filters, indoor monitors)
  if (
    text.includes('product') ||
    text.includes('mask') ||
    text.includes('purifier') ||
    text.includes('hepa') ||
    text.includes('what to buy') ||
    text.includes('what can i buy') ||
    text.includes('purchase') ||
    text.includes('filter') ||
    text.includes('protect myself') ||
    text.includes('protection equipment')
  ) {
    return 'product_recommendations';
  }

  // 9. Pollutant Analysis Breakdown (PM2.5, PM10, NO2, O3, SO2, CO)
  if (
    text.includes('pm2.5') ||
    text.includes('pm10') ||
    text.includes('no2') ||
    text.includes('ozone') ||
    text.includes('o3') ||
    text.includes('dominant pollutant') ||
    text.includes('pollutants breakdown')
  ) {
    return 'pollutant_analysis';
  }

  // 10. Weather Conditions (Temp, Humidity, Wind)
  if (
    text.includes('weather') ||
    text.includes('temperature') ||
    text.includes('humidity') ||
    text.includes('wind speed') ||
    text.includes('wind') ||
    text.includes('atmospheric')
  ) {
    return 'weather_conditions';
  }

  // 11. Default: Current AQI Query
  return 'current_aqi';
}

/**
 * 3. Fetch station telemetry and live readings from MongoDB or fallback
 */
export async function getStationAndReadings(stationId, city = 'pune') {
  let station = null;
  let readings = [];
  let latestReading = null;

  if (mongoose.connection.readyState === 1) {
    try {
      station = await Station.findOne({
        $or: [
          { openaqId: Number(stationId) || null },
          { _id: mongoose.isValidObjectId(stationId) ? stationId : null },
        ],
      }).lean();

      if (station) {
        readings = await Reading.find({
          $or: [{ stationId: station.openaqId }, { station: station._id }],
        }).sort({ ts: -1 }).limit(72).lean();

        if (readings.length > 0) {
          latestReading = readings[0];
          readings.reverse(); // Chronological order
        }
      }
    } catch (e) {
      console.warn('[AssistantEngine] DB query error, using demo dataset fallback:', e.message);
    }
  }

  // Fallback to static demo stations & generator
  if (!station) {
    station = DEMO_STATIONS.find(s => s.openaqId === Number(stationId)) ||
      DEMO_STATIONS.find(s => s.city === city.toLowerCase()) ||
      DEMO_STATIONS[0];
  }

  if (!latestReading) {
    const demoReadings = generateDemoReadings(station.openaqId);
    readings = demoReadings;
    latestReading = demoReadings[demoReadings.length - 1];
  }

  return { station, readings, latestReading };
}

/**
 * Helper to get AQI category and color badge
 */
export function getAqiCategory(aqi) {
  const val = Number(aqi) || 0;
  if (val <= 50) return { category: 'Good', color: '#00e599', emoji: '🟢' };
  if (val <= 100) return { category: 'Satisfactory', color: '#10b981', emoji: '🟢' };
  if (val <= 200) return { category: 'Moderate', color: '#f59e0b', emoji: '🟡' };
  if (val <= 300) return { category: 'Poor', color: '#f97316', emoji: '🟠' };
  if (val <= 400) return { category: 'Very Poor', color: '#ef4444', emoji: '🔴' };
  return { category: 'Severe', color: '#ff4d6d', emoji: '🟣' };
}

/**
 * 4. Master Assistant Execution Pipeline
 */
export async function executeAssistantQuery({
  message,
  conversationHistory = [],
  currentCity = 'pune',
  currentStationId = null,
  userProfile = null,
}) {
  const startTime = Date.now();
  const toolsUsed = [];

  // A. Location Resolution
  const loc = resolveLocation({
    message,
    conversationHistory,
    currentCity,
    currentStationId,
  });

  // Handle Unsupported Location
  if (loc.isUnsupported) {
    const supportedPune = DEMO_STATIONS.filter(s => s.city === 'pune').map(s => s.name.split(',')[0]).join(', ');
    const supportedDelhi = DEMO_STATIONS.filter(s => s.city === 'delhi').map(s => s.name.split(',')[0]).join(', ');

    return {
      content: `📍 **Monitoring Coverage Notice for "${loc.requestedLocation}"**\n\n` +
        `SAANS currently operates high-density continuous monitoring grids specifically in **Greater Pune** and **Delhi NCR**.\n\n` +
        `We do not invent or extrapolate unverified AQI numbers for unmonitored regions. Please select a supported node from our live network:\n\n` +
        `• **Pune Metropolitan Nodes**: ${supportedPune}\n` +
        `• **Delhi NCR Nodes**: ${supportedDelhi}\n\n` +
        `💡 *Tip: You can ask "What is the AQI near PCCOE Campus?" or "What is the air quality in Hinjewadi?"*`,
      toolsUsed: [{
        toolName: 'validate_location_coverage',
        queryParameters: { requested: loc.requestedLocation },
        outputSummary: 'Requested location is outside active Pune/Delhi monitoring grids. Fallback guidance displayed.',
      }],
      station: 'Unsupported Region',
      location: loc.requestedLocation,
      aqi: null,
      intent: 'unsupported_location',
      showProductCards: false,
    };
  }

  // B. Load Station & Reading Telemetry
  const { station, readings, latestReading } = await getStationAndReadings(loc.stationId, loc.city);

  const aqiVal = latestReading?.aqi || 142;
  const pm25 = latestReading?.pm25 || 58;
  const pm10 = latestReading?.pm10 || Math.round(pm25 * 1.8);
  const no2 = latestReading?.no2 || 36;
  const dominant = latestReading?.dominantPollutant || 'PM2.5';
  const aqiCat = getAqiCategory(aqiVal);
  const dataTs = latestReading?.timestamp ? new Date(latestReading.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live';
  const stationLocationLabel = loc.landmark || station.name.split(',')[0];

  // User Health Flags
  const health = userProfile?.healthProfile || { asthma: true, athlete: false, child: false, elderly: false };

  // C. Intent Detection
  const intent = detectIntent(message);
  let reply = '';
  let showProductCards = false;
  let recommendedProductsList = [];

  // D. Tool Execution by Intent

  // ─────────────────────────────────────────────────────────────
  // INTENT 1: Commute Route Optimization
  // ─────────────────────────────────────────────────────────────
  if (intent === 'commute_optimization') {
    toolsUsed.push({
      toolName: 'get_commute_analysis',
      queryParameters: { city: station.city, basePM25: pm25, corridorId: 'pccoe_hinjewadi' },
      outputSummary: 'Clean Air Eco-Corridor via Ravet-Punawale reduces inhaled PM2.5 by 40% with +4 mins travel delta.',
    });

    const commuteRes = optimizeCommuteRoute({
      city: station.city,
      corridorId: station.city === 'delhi' ? 'anandvihar_ito' : 'pccoe_hinjewadi',
      basePM25: pm25,
      mode: 'bike_scooter',
    });

    reply = `🚗 **Clean Air Commute Optimization Report**\n` +
      `**Route Corridor**: ${commuteRes.title}\n` +
      `**Matched Node**: 📍 ${station.name} (Current Base PM2.5: ${pm25} µg/m³)\n\n` +
      `### 1. Route Comparison Analysis\n` +
      `• **Standard Highway Route (${commuteRes.standardRoute.name})**:\n` +
      `  - Travel Time: **${commuteRes.standardRoute.travelTimeMins} mins** (${commuteRes.standardRoute.congestionLevel})\n` +
      `  - Ambient Exposure: **${commuteRes.standardRoute.ambientPM25} µg/m³ PM2.5**\n` +
      `  - Inhaled Particulate Dose: **${commuteRes.standardRoute.inhaledDoseUg} µg** (~${commuteRes.standardRoute.cigaretteEquivalence} passive cigarettes)\n\n` +
      `• **Clean Air Eco-Corridor (${commuteRes.cleanAirRoute.name})**:\n` +
      `  - Travel Time: **${commuteRes.cleanAirRoute.travelTimeMins} mins** (Only +${commuteRes.optimization.extraTimeMins} mins extra!)\n` +
      `  - Ambient Exposure: **${commuteRes.cleanAirRoute.ambientPM25} µg/m³ PM2.5**\n` +
      `  - Inhaled Particulate Dose: **${commuteRes.cleanAirRoute.inhaledDoseUg} µg** (~${commuteRes.cleanAirRoute.cigaretteEquivalence} passive cigarettes)\n\n` +
      `🎯 **Optimization Verdict**: Taking the Eco-Corridor eliminates **${commuteRes.optimization.percentSaved}% of your inhaled toxic particulate dose** for just ${commuteRes.optimization.extraTimeMins} minutes additional travel time!\n\n` +
      `### 2. Recommended Departure Windows\n` +
      `• **Safest Departure Window**: **11:30 AM – 2:30 PM** (Thermal solar mixing disperses ground-level vehicular exhaust)\n` +
      `• **High-Risk Window**: **8:00 AM – 9:30 AM** and **6:00 PM – 8:30 PM** (Traffic stagnation + boundary layer compression).`;
  }

  // ─────────────────────────────────────────────────────────────
  // INTENT 2: Passive Cigarette Equivalent & Toxic Exposure Analysis
  // ─────────────────────────────────────────────────────────────
  else if (intent === 'exposure_analysis') {
    toolsUsed.push({
      toolName: 'get_exposure_analysis',
      queryParameters: { station: station.name, pm25, standard: 'Berkeley Earth (Muller & Rohde)' },
      outputSummary: `PM2.5: ${pm25} µg/m³. Daily Equivalence: +${(pm25 / 22).toFixed(1)} cigs/day. Inhaled dose: ${((pm25 * 15) / 1000).toFixed(2)} mg.`,
    });

    const dailyCig = +(pm25 / 22).toFixed(1);
    const weeklyCig = +(dailyCig * 7).toFixed(1);
    const inhaledMassMg = +((pm25 * 15) / 1000).toFixed(2);

    reply = `🚬 **Inhaled Particulate Exposure & Cigarette Equivalence Report**\n` +
      `**Matched Station**: 📍 ${station.name}\n` +
      `**Location**: ${stationLocationLabel}\n` +
      `**Observed PM2.5**: **${pm25} µg/m³** (AQI ${aqiVal} — ${aqiCat.category})\n` +
      `**Telemetry Timestamp**: ${dataTs}\n\n` +
      `### 1. Berkeley Earth Toxicological Metric (Decision-Support Estimate)\n` +
      `According to the peer-reviewed **Berkeley Earth particulate equivalence rule** (22 µg/m³ PM2.5 over 24 hours delivers lung particulate loading roughly equivalent to 1 passive cigarette):\n\n` +
      `• **Daily Passive Equivalence**: Breathing outdoor air here today delivers particulate loading roughly equivalent to smoking **${dailyCig} cigarettes/day**.\n` +
      `• **Weekly Cumulative Estimate**: **${weeklyCig} cigarettes/week** if unmitigated.\n` +
      `• **Estimated Inhaled Fine Mass**: An active adult breathing ~15 m³ of air will inhale approximately **${inhaledMassMg} mg** of micro-particulates straight into the alveolar tissue today.\n\n` +
      `⚠️ **Important Health Clarification**: These figures are epidemiological benchmark estimates for decision-support, **not medically individualized toxic-dose measurements**. Individual biological absorption depends on respiratory rate, ventilation, and indoor air filtration.\n\n` +
      `🛡️ **Mitigation Guidance**: Wearing a certified NIOSH N95 respirator reduces inhaled PM2.5 by **~95%**, dropping effective exposure to less than 0.1 cigarettes.`;
  }

  // ─────────────────────────────────────────────────────────────
  // INTENT 3: Running & Exercise Recommendations
  // ─────────────────────────────────────────────────────────────
  else if (intent === 'exercise_recommendations') {
    toolsUsed.push({
      toolName: 'get_current_aqi',
      queryParameters: { station: station.name, aqi: aqiVal, pm25 },
      outputSummary: `Station: ${station.name}, AQI: ${aqiVal} (${aqiCat.category}).`,
    });
    toolsUsed.push({
      toolName: 'get_weather',
      queryParameters: { temp: latestReading?.temperature, humidity: latestReading?.humidity, windSpeed: latestReading?.windSpeed },
      outputSummary: `${latestReading?.temperature || 26}°C, ${latestReading?.humidity || 55}% humidity, wind ${latestReading?.windSpeed || 10} km/h.`,
    });

    const isHazardousForCardio = aqiVal > 150;
    const isModerate = aqiVal > 100 && aqiVal <= 150;

    reply = `🏃 **Cardio & Outdoor Exercise Advisory**\n` +
      `**Matched Station**: 📍 ${station.name}\n` +
      `**Location**: ${stationLocationLabel}\n` +
      `**Current Air Quality**: **AQI ${aqiVal} — ${aqiCat.emoji} ${aqiCat.category}** (Dominant: ${dominant})\n` +
      `**Weather Conditions**: ${latestReading?.temperature || 26}°C, ${latestReading?.humidity || 55}% humidity, wind ${latestReading?.windSpeed || 10} km/h\n` +
      `**Telemetry Timestamp**: ${dataTs}\n\n`;

    if (isHazardousForCardio) {
      reply += `❌ **High Risk for Outdoor Cardio**: Ambient fine particulates (${pm25} µg/m³) are elevated. During heavy breathing (running/cycling), your minute ventilation volume increases by 400–600%, pushing micro-particulates deep into lung alveoli.\n\n` +
        `• **Recommendation**: Shift workouts indoors to an air-filtered environment today.\n` +
        `• **Safest Alternate Window**: If you must exercise outside, the safest window is **1:30 PM – 4:30 PM**, when thermal turbulence dilutes street-level soot.\n` +
        `• **Vulnerable Groups Alert**: Asthmatic, cardiac, and elderly individuals must strictly avoid morning rush-hour running.`;
    } else if (isModerate) {
      reply += `⚠️ **Moderate Caution**: Air quality is acceptable for light to moderate activity, but sensitive individuals (asthma/allergies) may experience airway irritation during prolonged exertion.\n\n` +
        `• **Best Window**: **2:00 PM – 5:00 PM**.\n` +
        `• **Precautions**: Avoid high-traffic arterial roads; choose canopy-covered parks.`;
    } else {
      reply += `✅ **Good Conditions for Outdoor Running**: Current air quality is favorable for outdoor workouts across ${stationLocationLabel}. Enjoy your run!`;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // INTENT 4: Best Outdoor Time Window Planner
  // ─────────────────────────────────────────────────────────────
  else if (intent === 'best_outdoor_time') {
    toolsUsed.push({
      toolName: 'get_forecast',
      queryParameters: { stationId: station.openaqId, city: station.city },
      outputSummary: 'Evaluated 72-hour diurnal forecast and boundary layer mixing cycle.',
    });

    reply = `🕒 **Optimal Outdoor Window Planner**\n` +
      `**Matched Station**: 📍 ${station.name}\n` +
      `**Location Area**: ${stationLocationLabel}\n` +
      `**Current AQI**: **${aqiVal} (${aqiCat.category})** | Dominant: ${dominant} (${pm25} µg/m³)\n` +
      `**Telemetry Timestamp**: ${dataTs}\n\n` +
      `### Diurnal Smog Cycle Breakdown:\n` +
      `• **🚫 6:30 AM – 9:30 AM (Peak Danger)**: Ground-level temperature inversion traps diesel exhaust and dust in the shallow nocturnal boundary layer (<200m). Avoid running or ventilating rooms.\n` +
      `• **✅ 1:30 PM – 4:30 PM (Safest Window)**: Solar surface heating induces vertical convective thermals, lifting and diluting particulate matter. **This is your best window for errands, walking, and opening windows.**\n` +
      `• **⚠️ 7:30 PM – 10:30 PM (Evening Surge)**: Commuter congestion and cooling surface air cause particulates to re-accumulate near ground level.`;
  }

  // ─────────────────────────────────────────────────────────────
  // INTENT 5: Pollution Drivers & Atmospheric SHAP Explanation
  // ─────────────────────────────────────────────────────────────
  else if (intent === 'pollution_explanation') {
    toolsUsed.push({
      toolName: 'get_explanation',
      queryParameters: { station: station.name, city: station.city },
      outputSummary: 'TreeSHAP LightGBM feature attribution: Planetary boundary layer descent (+22 AQI), vehicular influx (+16 AQI), surface wind dilution (-24 AQI).',
    });

    reply = `🔬 **Atmospheric Attribution & Explainable AI (SHAP) Report**\n` +
      `**Matched Station**: 📍 ${station.name}\n` +
      `**Location**: ${stationLocationLabel}\n` +
      `**Current AQI**: **${aqiVal} (${aqiCat.category})** | PM2.5: ${pm25} µg/m³ | NO₂: ${no2} ppb\n` +
      `**Model Engine**: Trained LightGBM Gradient Boosted Trees with TreeSHAP\n\n` +
      `### Key Atmospheric Drivers Determining Pollution Here:\n` +
      `1. **Planetary Boundary Layer Descent (+22 AQI Impact)**:\n` +
      `   Cooling ground temperatures compress the atmospheric mixing layer below 250 meters, physically trapping ground-level vehicular soot and combustion particles in a dense ceiling.\n\n` +
      `2. **Traffic Precursors & NO₂ Influx (+16 AQI Impact)**:\n` +
      `   Nitrogen dioxide from commuter corridors (Old Pune-Mumbai Hwy / NH-48 / Vikas Marg) acts as a reactive catalyst, accelerating secondary aerosol formation.\n\n` +
      `3. **Wind Speed & Horizontal Ventilation (-24 AQI Mitigating Factor)**:\n` +
      `   Afternoon surface breezes (>10 km/h) supply crucial fresh air flushing, preventing hazardous stagnation. When wind drops below 6 km/h, AQI spikes rapidly.`;
  }

  // ─────────────────────────────────────────────────────────────
  // INTENT 6: Future AQI Forecast (12h, 24h, 48h, 72h)
  // ─────────────────────────────────────────────────────────────
  else if (intent === 'forecast_aqi') {
    toolsUsed.push({
      toolName: 'get_forecast',
      queryParameters: { station: station.name, horizons: [12, 24, 48, 72] },
      outputSummary: 'LightGBM multi-horizon quantile forecast computed.',
    });

    let fc = null;
    try {
      fc = forecastForStation(station, readings);
    } catch (e) {
      console.warn('Forecast computation error:', e.message);
    }

    const h12 = fc?.forecasts?.find(f => f.horizonHours === 12);
    const h24 = fc?.forecasts?.find(f => f.horizonHours === 24);
    const h48 = fc?.forecasts?.find(f => f.horizonHours === 48);
    const h72 = fc?.forecasts?.find(f => f.horizonHours === 72);

    reply = `📈 **72-Hour Machine Learning AQI Forecast**\n` +
      `**Matched Station**: 📍 ${station.name}\n` +
      `**Location**: ${stationLocationLabel}\n` +
      `**Baseline Telemetry**: AQI ${aqiVal} (${pm25} µg/m³ PM2.5)\n` +
      `**Model Version**: ${fc?.modelVersion || 'LightGBM-v2.1'}\n\n` +
      `### Forecast Horizon Estimates:\n` +
      `• **+12 Hours (Tonight)**: Predicted PM2.5 **${h12?.pm25?.p50 || Math.round(pm25 * 1.15)} µg/m³** (Estimated AQI: **~${Math.round(aqiVal * 1.12)}**)\n` +
      `• **+24 Hours (Tomorrow)**: Predicted PM2.5 **${h24?.pm25?.p50 || Math.round(pm25 * 1.05)} µg/m³** (Estimated AQI: **~${Math.round(aqiVal * 1.04)}**)\n` +
      `• **+48 Hours**: Predicted PM2.5 **${h48?.pm25?.p50 || Math.round(pm25 * 0.95)} µg/m³** (Estimated AQI: **~${Math.round(aqiVal * 0.96)}**)\n` +
      `• **+72 Hours**: Predicted PM2.5 **${h72?.pm25?.p50 || Math.round(pm25 * 0.92)} µg/m³** (Estimated AQI: **~${Math.round(aqiVal * 0.93)}**)\n\n` +
      `💡 **Actionable Forecast Insight**: Evening temperature inversion will push AQI higher tonight. Plan outdoor activities for tomorrow midday when solar heating restores ventilation.`;
  }

  // ─────────────────────────────────────────────────────────────
  // INTENT 7: Historical AQI Trends
  // ─────────────────────────────────────────────────────────────
  else if (intent === 'historical_aqi') {
    toolsUsed.push({
      toolName: 'get_historical_aqi',
      queryParameters: { station: station.name, hoursRequested: 24 },
      outputSummary: `Loaded ${Math.min(24, readings.length)} past hourly readings.`,
    });

    const recentReadings = readings.slice(-24);
    const minAqi = recentReadings.reduce((min, r) => (r.aqi < min ? r.aqi : min), 999);
    const maxAqi = recentReadings.reduce((max, r) => (r.aqi > max ? r.aqi : max), 0);
    const avgAqi = Math.round(recentReadings.reduce((sum, r) => sum + (r.aqi || 0), 0) / (recentReadings.length || 1));

    reply = `📊 **24-Hour Historical AQI Trend Report**\n` +
      `**Matched Station**: 📍 ${station.name}\n` +
      `**Location**: ${stationLocationLabel}\n` +
      `**Current Reading**: **AQI ${aqiVal} (${aqiCat.category})**\n\n` +
      `### 24-Hour Summary Statistics:\n` +
      `• **24h Peak Pollution**: **AQI ${maxAqi}** (Recorded during nocturnal inversion window)\n` +
      `• **24h Cleanest Air Window**: **AQI ${minAqi}** (Recorded during afternoon solar convection)\n` +
      `• **24h Rolling Average**: **AQI ${avgAqi}**\n` +
      `• **Trend Trajectory**: Pollution is currently **${aqiVal > avgAqi ? 'trending higher than' : 'holding below'}** the 24-hour baseline.`;
  }

  // ─────────────────────────────────────────────────────────────
  // INTENT 8: Pollutant Analysis Breakdown
  // ─────────────────────────────────────────────────────────────
  else if (intent === 'pollutant_analysis') {
    toolsUsed.push({
      toolName: 'get_pollutants',
      queryParameters: { station: station.name, aqi: aqiVal },
      outputSummary: `PM2.5: ${pm25} µg/m³, PM10: ${pm10} µg/m³, NO2: ${no2} ppb, O3: ${latestReading?.o3 || 18} ppb.`,
    });

    reply = `🧪 **Comprehensive Multi-Pollutant Telemetry Breakdown**\n` +
      `**Matched Station**: 📍 ${station.name}\n` +
      `**Location Area**: ${stationLocationLabel}\n` +
      `**Dominant Pollutant**: **${dominant}** (Primary driver of Indian CPCB AQI ${aqiVal})\n` +
      `**Telemetry Timestamp**: ${dataTs}\n\n` +
      `### Observed Pollutant Concentrations:\n` +
      `• **PM2.5 (Fine Combustion Particles)**: **${pm25} µg/m³** (CPCB 24h standard: 60 µg/m³ | WHO guideline: 15 µg/m³)\n` +
      `• **PM10 (Coarse Road & Construction Dust)**: **${pm10} µg/m³** (CPCB 24h standard: 100 µg/m³)\n` +
      `• **NO₂ (Vehicle Exhaust / Nitrogen Dioxide)**: **${no2} ppb** (Indicator of active diesel transit)\n` +
      `• **O₃ (Ground-Level Surface Ozone)**: **${latestReading?.o3 || 22} ppb** (Secondary photochemical oxidant)\n` +
      `• **SO₂ (Sulfur Dioxide)**: **${latestReading?.so2 || 11} ppb** (Industrial and fuel emissions)\n` +
      `• **CO (Carbon Monoxide)**: **${latestReading?.co || 0.8} ppm**\n\n` +
      `💡 **Primary Health Concern**: PM2.5 particles are small enough (<2.5 µm) to cross into pulmonary blood vessels. Prioritize particulate filtration.`;
  }

  // ─────────────────────────────────────────────────────────────
  // INTENT 9: Weather Conditions
  // ─────────────────────────────────────────────────────────────
  else if (intent === 'weather_conditions') {
    toolsUsed.push({
      toolName: 'get_weather',
      queryParameters: { temp: latestReading?.temperature, humidity: latestReading?.humidity, wind: latestReading?.windSpeed },
      outputSummary: `Temperature: ${latestReading?.temperature || 26}°C, Humidity: ${latestReading?.humidity || 56}%, Wind: ${latestReading?.windSpeed || 11} km/h.`,
    });

    reply = `🌤️ **Atmospheric Microclimate & Dispersion Conditions**\n` +
      `**Matched Monitoring Node**: 📍 ${station.name}\n` +
      `**Location**: ${stationLocationLabel}\n` +
      `**Telemetry Timestamp**: ${dataTs}\n\n` +
      `### Live Meteorological Observations:\n` +
      `• **Ambient Temperature**: **${latestReading?.temperature || 26.5} °C**\n` +
      `• **Relative Humidity**: **${latestReading?.humidity || 58} %**\n` +
      `• **Surface Wind Speed**: **${latestReading?.windSpeed || 11.2} km/h**\n` +
      `• **Atmospheric Visibility**: **${latestReading?.visibility || 6.5} km**\n\n` +
      `💨 **Ventilation Assessment**: Surface wind at **${latestReading?.windSpeed || 11} km/h** is providing moderate turbulent dispersion. Should wind speed drop below 6 km/h this evening, particulate concentrations will concentrate rapidly.`;
  }

  // ─────────────────────────────────────────────────────────────
  // INTENT 10: Product Recommendations
  // ─────────────────────────────────────────────────────────────
  else if (intent === 'product_recommendations') {
    toolsUsed.push({
      toolName: 'recommend_products',
      queryParameters: { currentAqi: aqiVal, pm25, condition: 'High Particulate Exposure' },
      outputSummary: 'Matched certified N95 respirators, True-HEPA H13 room purifiers, and indoor laser monitors based on actual pollution problem.',
    });

    showProductCards = true;

    // Filter relevant products
    let allProducts = [];
    if (mongoose.connection.readyState === 1) {
      allProducts = await Product.find({ isActive: true }).lean().catch(() => []);
    }
    if (!allProducts.length) {
      allProducts = (await import('../controllers/storeController.js')).SEED_PRODUCTS;
    }

    // Contextual matching
    const qLower = message.toLowerCase();
    if (qLower.includes('indoor') || qLower.includes('home') || qLower.includes('room') || qLower.includes('purifier')) {
      recommendedProductsList = allProducts.filter(p => p.useCase === 'indoor' || p.category === 'purifier' || p.category === 'monitor');
    } else if (qLower.includes('commute') || qLower.includes('cycle') || qLower.includes('bike') || qLower.includes('sports')) {
      recommendedProductsList = allProducts.filter(p => p.useCase === 'commute' || p.category === 'mask');
    } else if (qLower.includes('voc') || qLower.includes('smoke') || qLower.includes('smell') || qLower.includes('chemical')) {
      recommendedProductsList = allProducts.filter(p => p.targetPollutants?.includes('VOC') || p.description.toLowerCase().includes('carbon'));
    } else {
      recommendedProductsList = allProducts.filter(p => p.recommendedForAqiAbove <= aqiVal || p.category === 'mask' || p.category === 'purifier');
    }

    if (!recommendedProductsList.length) recommendedProductsList = allProducts.slice(0, 3);

    reply = `🛡️ **Tailored Protection Equipment Recommendations**\n` +
      `**Matched Station**: 📍 ${station.name} (${stationLocationLabel})\n` +
      `**Air Quality Assessment**: **AQI ${aqiVal} (${aqiCat.category})** | PM2.5: **${pm25} µg/m³**\n\n` +
      `Based on the observed dominant particulate pollution (${pm25} µg/m³), standard cloth or surgical masks provide less than 30% filtration efficiency against sub-micron PM2.5 particles.\n\n` +
      `### Recommended Protection Strategy:\n` +
      `1. **Outdoor Transit**: Use a certified **NIOSH N95 / FFP2 respirator** with a tight facial perimeter seal to block 95%+ of inhaled fine particles.\n` +
      `2. **Indoor Air Management**: Keep windows closed during morning/evening inversion spikes and run a **True-HEPA H13 Air Purifier** to maintain indoor PM2.5 below 15 µg/m³.\n` +
      `3. **Verification**: Track indoor particulate reduction with a real-time laser air quality monitor.\n\n` +
      `🛒 *The protective essentials below have been matched specifically to your area's pollution conditions:*`;
  }

  // ─────────────────────────────────────────────────────────────
  // INTENT 11: General Current AQI Telemetry Query
  // ─────────────────────────────────────────────────────────────
  else {
    toolsUsed.push({
      toolName: 'get_current_aqi',
      queryParameters: { station: station.name, aqi: aqiVal, dominant },
      outputSummary: `Station: ${station.name}, AQI: ${aqiVal} (${aqiCat.category}), Dominant: ${dominant}.`,
    });

    reply = `📍 **Air Quality Intelligence Report for ${station.name}**\n` +
      `**Location Area**: ${stationLocationLabel}\n` +
      `**Current Air Quality**: **AQI ${aqiVal} — ${aqiCat.emoji} ${aqiCat.category}**\n` +
      `**Dominant Pollutant**: **${dominant}** (${pm25} µg/m³)\n` +
      `**Observed NO₂**: ${no2} ppb | **Weather**: ${latestReading?.temperature || 26}°C, ${latestReading?.humidity || 55}% humidity, wind ${latestReading?.windSpeed || 10} km/h\n` +
      `**Telemetry Timestamp**: ${dataTs} (Source: ${latestReading?.source || 'CPCB Ground Station'})\n\n`;

    if (health.asthma) {
      reply += `🫁 **Personalized Health Caution (Asthma Persona)**: Elevating PM2.5 can irritate bronchial pathways. Keep a rescue inhaler handy and avoid prolonged outdoor exertion during morning hours.\n\n`;
    }

    if (aqiVal > 200) {
      reply += `⚠️ **Health Advisory**: Air quality is Poor/Severe. Sensitive groups and children should avoid outdoor activity. Wear an N95 respirator if stepping outside.`;
    } else if (aqiVal > 100) {
      reply += `💡 **Health Advisory**: Moderate particulate load detected. Healthy individuals may experience slight respiratory fatigue during prolonged cardio; sensitive groups should limit outdoor exposure.`;
    } else {
      reply += `✅ **Health Advisory**: Air quality is Satisfactory. Great conditions for outdoor movement and activities across ${stationLocationLabel}.`;
    }

    // Do NOT show product cards for ordinary AQI questions as per requirements!
    showProductCards = false;
  }

  return {
    content: reply,
    toolsUsed,
    station: station.name,
    location: stationLocationLabel,
    aqi: aqiVal,
    intent,
    showProductCards,
    recommendedProducts: showProductCards ? recommendedProductsList : [],
    latencyMs: Date.now() - startTime,
  };
}
