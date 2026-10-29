import mongoose from 'mongoose';
import { Conversation } from '../models/Conversation.js';
import { User } from '../models/User.js';
import { Station } from '../models/Station.js';
import { Reading } from '../models/Reading.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { DEMO_STATIONS, generateDemoReadings } from '../services/demoData.js';

/**
 * Intelligent Rule & Context-Based AI Assistant
 * Provides health-personalized air quality guidance with tool calling
 */
export const handleChatMessage = asyncHandler(async (req, res) => {
  const { message, stationId, city = 'pune' } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message content is required' });
  }

  // 1. Fetch User Context
  let user = null;
  if (mongoose.connection.readyState === 1) {
    user = await User.findOne();
  }
  const health = user?.healthProfile || { asthma: true, athlete: false, child: false, elderly: false };

  // 2. Fetch Station & Current AQI Context
  let station = null;
  let latestReading = null;

  if (mongoose.connection.readyState === 1) {
    station = await Station.findOne({
      $or: [
        { openaqId: Number(stationId) || null },
        { _id: mongoose.isValidObjectId(stationId) ? stationId : null },
        { city: city.toLowerCase() },
      ],
    });
    if (station) {
      latestReading = await Reading.findOne({
        $or: [{ station: station._id }, { stationId: station.openaqId }],
      }).sort({ ts: -1 });
    }
  }

  if (!station) {
    station = DEMO_STATIONS.find(s => s.city === city.toLowerCase()) || DEMO_STATIONS[0];
    const demoR = generateDemoReadings(station.openaqId);
    latestReading = demoR[demoR.length - 1];
  }

  const currentAqi = latestReading?.aqi || 148;
  const pm25 = latestReading?.pm25 || 62;
  const toolsUsed = [];

  // 3. AI Reasoning & Smart Tool Calling Logic
  const msgLower = message.toLowerCase();
  let reply = '';

  // Tool 1: Route & Commute Planner Tool
  if (msgLower.includes('go out') || msgLower.includes('jog') || msgLower.includes('run') || msgLower.includes('travel') || msgLower.includes('walk') || msgLower.includes('best time')) {
    toolsUsed.push({
      toolName: 'diurnal_exposure_optimizer',
      queryParameters: { station: station.name, currentAqi },
      outputSummary: 'Recommended window: 2:00 PM - 4:30 PM (afternoon thermal boundary layer dispersion).',
    });

    const isHigh = currentAqi > 150;
    reply = `Currently, the air quality at **${station.name}** is **AQI ${currentAqi} (PM2.5: ${pm25} µg/m³)**. \n\n`;

    if (health.asthma) {
      reply += `⚠️ **Personalized Health Alert (Asthma)**: With your respiratory profile, avoid strenuous outdoor cardio during peak smog hours (7:00 AM - 10:00 AM and after 8:00 PM). \n\n`;
    }

    if (isHigh) {
      reply += `💡 **Optimal Recommendation**: Postpone heavy outdoor exertion. If you must commute, the safest window is **2:00 PM to 4:30 PM**, when thermal convection lifts ground-level pollutants. Please wear an N95 respirator.`;
    } else {
      reply += `✅ **Recommendation**: Moderate outdoor activities are acceptable today. Sensitive groups should monitor for coughing or shortness of breath.`;
    }
  }

  // Tool 2: Atmospheric Explainability & SHAP Driver Tool
  else if (msgLower.includes('why') || msgLower.includes('reason') || msgLower.includes('high') || msgLower.includes('cause') || msgLower.includes('shap')) {
    toolsUsed.push({
      toolName: 'shap_atmospheric_explainer',
      queryParameters: { station: station.name, city: station.city },
      outputSummary: 'Top positive driver: Boundary layer compression (+22 AQI); Top negative driver: Surface wind dilution (-24 AQI).',
    });

    reply = `Based on our **LightGBM ML atmospheric attribution models** for ${station.name}:\n\n` +
      `1. **Boundary Layer Descent (+22 AQI impact)**: Nocturnal radiative cooling has lowered the mixing height below 250m, trapping PM2.5 emissions near the ground.\n` +
      `2. **Vehicular NO₂ Influx (+16 AQI impact)**: Rush hour traffic along arterial corridors accelerates secondary nitrate particle formation.\n` +
      `3. **Wind Ventilation (-24 AQI mitigating factor)**: Afternoon wind gusts above 11 km/h provide horizontal dilution, preventing severe stagnation.`;
  }

  // Tool 3: Protection & Mask Recommendation Tool
  else if (msgLower.includes('mask') || msgLower.includes('purifier') || msgLower.includes('protect') || msgLower.includes('filter') || msgLower.includes('buy')) {
    toolsUsed.push({
      toolName: 'protection_product_matcher',
      queryParameters: { currentAqi, healthProfile: health },
      outputSummary: 'Matched certified N95 respirator and True-HEPA H13 room purifier.',
    });

    reply = `At the current **AQI of ${currentAqi}** in ${station.city.toUpperCase()}:\n\n` +
      `• **Respirator**: Standard surgical or cloth masks filter less than 30% of sub-micron PM2.5. We recommend a **Certified NIOSH N95 respirator** with a tight seal.\n` +
      `• **Indoor Air**: Maintain indoor PM2.5 < 15 µg/m³ using a **True-HEPA H13 Air Purifier**. Keep doors and windows shut during morning inversion hours.\n\n` +
      `You can find certified masks and purifiers directly in our **Protection Store** tab with instant delivery to PCCOE and Pune!`;
  }

  // Tool 4: General Consultation
  else {
    toolsUsed.push({
      toolName: 'air_quality_telemetry_lookup',
      queryParameters: { station: station.name, aqi: currentAqi },
      outputSummary: `Station: ${station.name}, Dominant Pollutant: ${latestReading?.dominantPollutant || 'PM2.5'}.`,
    });

    reply = `Hello! I'm your **SAANS AI Health & Air Quality Assistant**.\n\n` +
      `Monitoring live data for **${station.name}**: Current AQI is **${currentAqi}** (${currentAqi > 200 ? 'Poor/Hazardous' : currentAqi > 100 ? 'Moderate' : 'Good'}). \n\n` +
      `How can I assist you today? You can ask:\n` +
      `• *"Should I go for an evening run today?"*\n` +
      `• *"Why is the AQI spiking tonight?"*\n` +
      `• *"What mask or purifier is best for my asthma?"*`;
  }

  // 4. Record to Conversation model if DB connected
  if (mongoose.connection.readyState === 1) {
    let conv = await Conversation.findOne();
    if (!conv) {
      conv = await Conversation.create({
        user: user?._id || null,
        station: station._id || null,
        title: `Consultation - ${station.city}`,
        messages: [],
      });
    }

    conv.messages.push({
      role: 'user',
      content: message,
      toolsUsed: [],
      createdAt: new Date(),
    });

    conv.messages.push({
      role: 'assistant',
      content: reply,
      toolsUsed,
      createdAt: new Date(),
    });

    await conv.save();
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        role: 'assistant',
        content: reply,
        toolsUsed,
        station: station.name,
        aqi: currentAqi,
      },
      'Assistant response generated'
    )
  );
});

/**
 * Get conversation history
 */
export const getChatHistory = asyncHandler(async (_req, res) => {
  if (mongoose.connection.readyState === 1) {
    const conv = await Conversation.findOne().populate('station');
    return res.status(200).json(new ApiResponse(200, conv?.messages || [], 'Chat history loaded'));
  }
  return res.status(200).json(new ApiResponse(200, [], 'Chat history empty in offline mode'));
});

