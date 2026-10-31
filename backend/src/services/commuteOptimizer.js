/**
 * Clean Air Commute & Corridor Optimization Engine
 * Calculates route-specific environmental exposure, inhaled toxic dose,
 * and identifies Clean Air Eco-Corridors across Pune & Delhi.
 */

export const CORRIDOR_PRESETS = {
  pune: [
    {
      id: 'pccoe_hinjewadi',
      title: 'PCCOE Campus (Akurdi) ➔ Hinjewadi IT Park Phase 1',
      distanceKm: 16.5,
      standardRoute: {
        name: 'Arterial Corridor via Old Pune-Mumbai Hwy & Wakad Flyover',
        travelTimeMins: 32,
        congestionLevel: 'High (Stop-and-Go Stagnation)',
        exposureFactor: 1.35, // Amplified exposure from idling diesel trucks
        dominantPollutant: 'NO₂ + PM2.5',
        roadType: 'Industrial Heavy Traffic Arterial',
      },
      cleanAirRoute: {
        name: 'Clean Air Eco-Corridor via Ravet-Punawale Green Buffer',
        travelTimeMins: 36, // Only 4 mins extra!
        congestionLevel: 'Low (Free Flow Aerodynamic Dispersion)',
        exposureFactor: 0.72,
        dominantPollutant: 'PM2.5',
        roadType: 'Suburban Tree-Lined Ring Road',
      },
    },
    {
      id: 'pccoe_shivajinagar',
      title: 'PCCOE Vicinity (Nigdi) ➔ Shivajinagar / Pune Central',
      distanceKm: 18.2,
      standardRoute: {
        name: 'Direct Arterial Corridor via Pimpri-Chinchwad Grade Separator',
        travelTimeMins: 40,
        congestionLevel: 'Severe (Evening Commute Trap)',
        exposureFactor: 1.4,
        dominantPollutant: 'PM10 + NO₂',
        roadType: 'Multi-lane Highway Trench with Thermal Inversion',
      },
      cleanAirRoute: {
        name: 'Clean Air Eco-Corridor via Aundh-Khadki Cantonment Buffer',
        travelTimeMins: 44,
        congestionLevel: 'Low-Moderate (High Canopy Tree Scrubbing)',
        exposureFactor: 0.78,
        dominantPollutant: 'PM2.5',
        roadType: 'Canopy-Protected Defense Green Corridor',
      },
    },
    {
      id: 'bhosari_wakad',
      title: 'Bhosari Industrial Hub ➔ Wakad Residential Corridor',
      distanceKm: 12.8,
      standardRoute: {
        name: 'Nashik Phata & Spine Road Commercial Corridor',
        travelTimeMins: 28,
        congestionLevel: 'High Commercial Influx',
        exposureFactor: 1.45,
        dominantPollutant: 'SO₂ + PM2.5',
        roadType: 'Freight Corridor',
      },
      cleanAirRoute: {
        name: 'Clean Air Eco-Corridor via Thergaon Forest Route',
        travelTimeMins: 31,
        congestionLevel: 'Low Commercial Footprint',
        exposureFactor: 0.75,
        dominantPollutant: 'PM2.5',
        roadType: 'Residential Green Parkway',
      },
    },
  ],

  delhi: [
    {
      id: 'anandvihar_ito',
      title: 'Anand Vihar ISBT ➔ ITO / Connaught Place Central',
      distanceKm: 14.2,
      standardRoute: {
        name: 'Vikas Marg Dense Arterial Corridor',
        travelTimeMins: 42,
        congestionLevel: 'Severe Inversion & Heavy Bus Stagnation',
        exposureFactor: 1.42,
        dominantPollutant: 'PM2.5 + NO₂',
        roadType: 'Dense Mixed Commercial Arterial',
      },
      cleanAirRoute: {
        name: 'Clean Air Eco-Corridor via Barapullah Elevated / Yamuna Floodplain',
        travelTimeMins: 46,
        congestionLevel: 'Free Flow Elevated Corridor',
        exposureFactor: 0.74,
        dominantPollutant: 'PM2.5',
        roadType: 'Elevated River Breeze Corridor',
      },
    },
    {
      id: 'punjabibagh_rkpuram',
      title: 'Punjabi Bagh (West) ➔ RK Puram / South Delhi',
      distanceKm: 19.5,
      standardRoute: {
        name: 'Ring Road Dhaula Kuan Bottleneck Corridor',
        travelTimeMins: 45,
        congestionLevel: 'High Congestion Stagnation',
        exposureFactor: 1.38,
        dominantPollutant: 'PM2.5',
        roadType: 'Urban Ring Highway',
      },
      cleanAirRoute: {
        name: 'Clean Air Eco-Corridor via Central Ridge Forest Buffer Route',
        travelTimeMins: 48,
        congestionLevel: 'Low (Vegetative Particle Trapping)',
        exposureFactor: 0.76,
        dominantPollutant: 'PM2.5',
        roadType: 'Ridge Protected Forest Bypass',
      },
    },
  ],
};

const MODE_VENTILATION = {
  car_ac: 0.35,     // Enclosed vehicle with HEPA cabin filter
  car_open: 0.85,   // Enclosed vehicle without filtration
  bus_transit: 1.1, // Public bus with open windows
  bike_scooter: 1.5,// Two-wheeler with elevated breathing rate
  bicycle: 2.2,     // Active exertion
};

/**
 * Computes comparative exposure metrics for a selected corridor
 */
export function optimizeCommuteRoute({
  city = 'pune',
  corridorId = 'pccoe_hinjewadi',
  basePM25 = 65,
  mode = 'bike_scooter',
}) {
  const cityKey = city.toLowerCase() === 'delhi' ? 'delhi' : 'pune';
  const corridors = CORRIDOR_PRESETS[cityKey] || CORRIDOR_PRESETS.pune;
  const corridor = corridors.find(c => c.id === corridorId) || corridors[0];

  const ventRate = MODE_VENTILATION[mode] || MODE_VENTILATION.bike_scooter;

  // 1. Calculate Standard Route Metrics
  const stdPM25 = Math.round(basePM25 * corridor.standardRoute.exposureFactor);
  const stdHours = corridor.standardRoute.travelTimeMins / 60;
  const stdVolM3 = +(ventRate * stdHours).toFixed(2);
  const stdDoseUg = +(stdPM25 * stdVolM3).toFixed(1);
  const stdCigarettes = +(stdDoseUg / (22 * 0.9)).toFixed(2); // Berkeley Earth equivalence for commute dose

  // 2. Calculate Clean Air Eco-Corridor Metrics
  const cleanPM25 = Math.round(basePM25 * corridor.cleanAirRoute.exposureFactor);
  const cleanHours = corridor.cleanAirRoute.travelTimeMins / 60;
  const cleanVolM3 = +(ventRate * cleanHours).toFixed(2);
  const cleanDoseUg = +(cleanPM25 * cleanVolM3).toFixed(1);
  const cleanCigarettes = +(cleanDoseUg / (22 * 0.9)).toFixed(2);

  // 3. Differential Impact
  const doseSavedUg = +(stdDoseUg - cleanDoseUg).toFixed(1);
  const percentSaved = stdDoseUg > 0 ? Math.round((doseSavedUg / stdDoseUg) * 100) : 0;
  const extraTimeMins = corridor.cleanAirRoute.travelTimeMins - corridor.standardRoute.travelTimeMins;

  // 4. Optimal Departure Time Windows
  const departureWindows = [
    {
      window: '8:00 AM – 9:30 AM',
      tag: 'Morning Rush Hour',
      risk: 'High Smog / Inversion Risk',
      aqiMultiplier: 1.25,
      recommendation: 'Wear N95 respirator. Heavy diesel truck emissions.',
    },
    {
      window: '11:30 AM – 2:30 PM',
      tag: 'Thermal Mixing Peak',
      risk: 'Safest Commute Window',
      aqiMultiplier: 0.78,
      recommendation: 'Recommended window! High solar convection dissipates ground-level plume.',
    },
    {
      window: '6:00 PM – 8:30 PM',
      tag: 'Evening Gridlock',
      risk: 'Highest Particulate Stagnation',
      aqiMultiplier: 1.35,
      recommendation: 'Avoid two-wheeler commute if asthmatic. Use Eco-Corridor.',
    },
  ];

  return {
    city: cityKey,
    corridorId: corridor.id,
    title: corridor.title,
    distanceKm: corridor.distanceKm,
    mode,
    modeLabel: mode.replace('_', ' ').toUpperCase(),
    standardRoute: {
      ...corridor.standardRoute,
      ambientPM25: stdPM25,
      inhaledDoseUg: stdDoseUg,
      cigaretteEquivalence: stdCigarettes,
    },
    cleanAirRoute: {
      ...corridor.cleanAirRoute,
      ambientPM25: cleanPM25,
      inhaledDoseUg: cleanDoseUg,
      cigaretteEquivalence: cleanCigarettes,
    },
    optimization: {
      percentSaved,
      doseSavedUg,
      extraTimeMins,
      efficiencyRatio: extraTimeMins > 0 ? +(percentSaved / extraTimeMins).toFixed(1) : percentSaved, // % clean air per extra minute!
      recommendation: `Taking the ${corridor.cleanAirRoute.name} eliminates ${percentSaved}% of inhaled toxic PM2.5 with only ${extraTimeMins} minutes extra commute time.`,
    },
    departureWindows,
    allCorridors: corridors.map(c => ({ id: c.id, title: c.title })),
  };
}

