// Actionable Exposure Planner & Episode Spike Early Warning Engine

const VENTILATION_RATES = {
  commute: 0.9,   // m³/hour for sedentary vehicle/bus transit
  walking: 1.4,   // m³/hour for brisk walking
  cycling: 2.2,   // m³/hour for outdoor cycling/jogging
};

export function calculateDose(pm25Concentration, durationMinutes, mode = 'commute') {
  const rate = VENTILATION_RATES[mode] || 1.0;
  const hours = durationMinutes / 60;
  const volumeInhaledM3 = +(rate * hours).toFixed(2);
  const doseMicrograms = +(pm25Concentration * volumeInhaledM3).toFixed(1);
  return { volumeInhaledM3, doseMicrograms };
}

export function compareDepartures(stationForecast, offsetA = 0, offsetB = 2, durationMinutes = 45, mode = 'commute') {
  const forecasts = stationForecast?.forecasts || [];
  if (!forecasts.length) {
    throw new Error('Forecast data unavailable for exposure comparison');
  }

  // Linear interpolation for hourly estimates from 12h, 24h, 48h, 72h
  function getEstimatedConcentration(hourOffset) {
    if (hourOffset <= 0) return stationForecast.currentPM25 || forecasts[0]?.pm25?.estimateUgM3 || 45;
    if (hourOffset <= 12) {
      const cur = stationForecast.currentPM25 || forecasts[0].pm25.estimateUgM3;
      return cur + (forecasts[0].pm25.estimateUgM3 - cur) * (hourOffset / 12);
    }
    if (hourOffset <= 24) {
      return forecasts[0].pm25.estimateUgM3 +
        (forecasts[1].pm25.estimateUgM3 - forecasts[0].pm25.estimateUgM3) * ((hourOffset - 12) / 12);
    }
    if (hourOffset <= 48) {
      return forecasts[1].pm25.estimateUgM3 +
        (forecasts[2].pm25.estimateUgM3 - forecasts[1].pm25.estimateUgM3) * ((hourOffset - 24) / 24);
    }
    return forecasts[3]?.pm25?.estimateUgM3 || forecasts[2]?.pm25?.estimateUgM3 || 50;
  }

  const concA = Math.round(getEstimatedConcentration(offsetA));
  const concB = Math.round(getEstimatedConcentration(offsetB));

  const doseA = calculateDose(concA, durationMinutes, mode);
  const doseB = calculateDose(concB, durationMinutes, mode);

  const diffDose = +(doseA.doseMicrograms - doseB.doseMicrograms).toFixed(1);
  const percentSaved = doseA.doseMicrograms > 0
    ? Math.max(0, Math.round(((doseA.doseMicrograms - doseB.doseMicrograms) / doseA.doseMicrograms) * 100))
    : 0;

  const betterChoice = doseB.doseMicrograms <= doseA.doseMicrograms ? 'B' : 'A';

  return {
    stationName: stationForecast.stationName,
    activity: mode,
    durationMinutes,
    optionA: {
      label: offsetA === 0 ? 'Now' : `In +${offsetA} hrs`,
      estimatedPM25: concA,
      inhaledDoseUg: doseA.doseMicrograms,
      airQualityBand: concA <= 30 ? 'Good' : concA <= 60 ? 'Satisfactory' : concA <= 90 ? 'Moderate' : 'Poor',
    },
    optionB: {
      label: `In +${offsetB} hrs`,
      estimatedPM25: concB,
      inhaledDoseUg: doseB.doseMicrograms,
      airQualityBand: concB <= 30 ? 'Good' : concB <= 60 ? 'Satisfactory' : concB <= 90 ? 'Moderate' : 'Poor',
    },
    comparison: {
      betterOption: betterChoice,
      percentReduction: percentSaved,
      doseSavedUg: Math.abs(diffDose),
      summary: percentSaved > 10
        ? `Delaying departure by ${Math.abs(offsetB - offsetA)} hours avoids ${percentSaved}% of PM2.5 inhalation.`
        : 'Air quality remains relatively stable across these departure windows.',
    },
  };
}

export function detectSpikeEpisodes(stationsWithForecast) {
  const alerts = [];
  for (const item of stationsWithForecast) {
    const { station, forecast } = item;
    if (!forecast || !forecast.forecasts) continue;

    let peakVal = 0;
    let peakHorizon = 12;

    for (const f of forecast.forecasts) {
      const val = f.pm25?.estimateUgM3 || 0;
      if (val > peakVal) {
        peakVal = val;
        peakHorizon = f.horizonHours;
      }
    }

    if (peakVal >= 75) {
      const isSevere = peakVal >= 110;
      alerts.push({
        id: `alert-${station.openaqId}-${peakHorizon}`,
        stationId: station.openaqId,
        stationName: station.name,
        city: station.city,
        level: isSevere ? 'Severe Episode Warning' : 'Elevated Risk Advisory',
        severity: isSevere ? 'high' : 'medium',
        peakPM25: Math.round(peakVal),
        horizonHours: peakHorizon,
        expectedWindow: `Peak expected in ~${peakHorizon} hrs`,
        action: isSevere
          ? 'Thermal inversion & stagnant winds expected. Reschedule heavy outdoor activities and wear an N95 respirator.'
          : 'Moderate particulate buildup. Sensitive individuals and school children should limit prolonged outdoor exertion.',
        confidence: '80% Prediction Band [P10–P90]',
      });
    }
  }
  return alerts;
}
