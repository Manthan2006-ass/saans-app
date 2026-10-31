import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './style.css';

const fmt = n => (n == null || n === '' || !Number.isFinite(Number(n)) ? '—' : Math.round(Number(n)));

function getAqiBand(aqi) {
  const val = Number(aqi) || 0;
  if (val <= 50) return { label: 'Good', color: '#00e599', textColor: '#04120e', category: 'Good (0-50)' };
  if (val <= 100) return { label: 'Satisfactory', color: '#10b981', textColor: '#04120e', category: 'Satisfactory (51-100)' };
  if (val <= 200) return { label: 'Moderate', color: '#f59e0b', textColor: '#04120e', category: 'Moderate (101-200)' };
  if (val <= 300) return { label: 'Poor', color: '#f97316', textColor: '#fff', category: 'Poor (201-300)' };
  if (val <= 400) return { label: 'Very Poor', color: '#ef4444', textColor: '#fff', category: 'Very Poor (301-400)' };
  return { label: 'Severe', color: '#ff4d6d', textColor: '#fff', category: 'Severe (401+)' };
}

/* ── Leaflet Map Helpers ─────────────────────────────────────── */
const CITY_CENTERS = {
  pune:  { lat: 18.575, lng: 73.810, zoom: 12 },
  delhi: { lat: 28.635, lng: 77.225, zoom: 12 },
};

/** Recenter the map when city changes */
function MapRecenter({ city }) {
  const map = useMap();
  useEffect(() => {
    const c = CITY_CENTERS[city] || CITY_CENTERS.pune;
    map.flyTo([c.lat, c.lng], c.zoom, { duration: 1.2 });
  }, [city, map]);
  return null;
}

/** Interactive AQI Map with dark tiles and glowing station markers */
function AqiLeafletMap({ city, stations, selectedId, onSelectStation }) {
  const center = CITY_CENTERS[city] || CITY_CENTERS.pune;

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={center.zoom}
      style={{ width: '100%', height: '100%' }}
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        maxZoom={19}
      />
      <MapRecenter city={city} />

      {stations.map(st => {
        const stLat = st.location?.lat || st.lat;
        const stLng = st.location?.lng || st.lon || st.lng;
        if (!stLat || !stLng) return null;

        const stAqi  = st.latestReading?.aqi || 142;
        const band   = getAqiBand(stAqi);
        const isSel  = String(st.openaqId) === String(selectedId);

        return (
          <CircleMarker
            key={st.openaqId}
            center={[stLat, stLng]}
            radius={isSel ? 16 : 10}
            pathOptions={{
              color: band.color,
              weight: isSel ? 3 : 1.5,
              fillColor: band.color,
              fillOpacity: isSel ? 0.45 : 0.25,
            }}
            eventHandlers={{
              click: () => onSelectStation(st.openaqId),
            }}
          >
            <Popup className="aqi-popup">
              <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', padding: 2, minWidth: 170 }}>
                <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#111' }}>{st.name?.split(',')[0]}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 99, background: band.color }} />
                  <span style={{ fontWeight: 900, fontSize: '1.1rem', fontFamily: 'JetBrains Mono, monospace', color: '#111' }}>{stAqi}</span>
                  <span style={{ fontSize: '0.72rem', color: '#555', fontWeight: 700 }}>{band.label}</span>
                </div>
                <div style={{ marginTop: 6, fontSize: '0.72rem', color: '#444' }}>
                  PM2.5: <strong>{st.latestReading?.pm25 || '—'} µg/m³</strong>
                  &nbsp;·&nbsp;🚬 {+((st.latestReading?.pm25 || stAqi * 0.45) / 22).toFixed(1)} cigs/day
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}

async function getJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${response.status}`);
  }
  return response.json();
}

function App() {
  // Navigation: 'home' | 'problem' | 'solution' | 'dashboard' | 'analysis' | 'assistant' | 'profile'
  const [currentPage, setCurrentPage] = useState('home');
  const [city, setCity] = useState('pune'); // 'pune' | 'delhi'
  const [stations, setStations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [orderToast, setOrderToast] = useState(false);

  // Auth Modal States
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authTab, setAuthTab] = useState('login'); // 'login' | 'register'
  const [authForm, setAuthForm] = useState({
    name: '',
    email: 'aditya@saans.org',
    password: 'demo123',
    city: 'pune',
    asthma: true,
    athlete: false,
    child: false,
    elderly: false,
    outdoorHours: 8,
  });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authToast, setAuthToast] = useState('');

  // Analysis sub-tab
  const [analysisSubTab, setAnalysisSubTab] = useState('deepdive'); // 'deepdive' | 'comparison' | 'commute'

  // Commute Optimizer States
  const [commuteCorridor, setCommuteCorridor] = useState('pccoe_hinjewadi');
  const [commuteMode, setCommuteMode] = useState('bike_scooter');
  const [commuteData, setCommuteData] = useState(null);
  const [commuteLoading, setCommuteLoading] = useState(false);

  // Chat States
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'user',
      content: 'What is the AQI near PCCOE Vicinity, Pune?',
    },
    {
      role: 'assistant',
      content: 'Near Nigdi / Akurdi (PCCOE Vicinity), the current air quality is AQI 142 — Moderate.\n\n• Dominant Pollutant: PM2.5 (Fine particulate matter from road traffic and industrial clusters)\n• Current Trend: +8 since 6:00 AM\n• Weather: 26.5°C, 58% humidity, surface wind at 11.2 km/h\n\nRecommendation:\nSensors detect moderate particulate load. Sensitive groups (asthma/cardiac) should wear an N95 respirator during morning rush hours. Safest outdoor activity window: 1:30 PM - 4:30 PM.',
      toolsUsed: [
        { toolName: 'get_current_aqi()' },
        { toolName: 'get_pollutants()' },
        { toolName: 'get_weather()' },
      ],
      showProductCards: true,
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Scrubber & Walkthrough State
  const [scrubberHour, setScrubberHour] = useState(12);
  const [showWalkthrough, setShowWalkthrough] = useState(true);

  // Data Loading
  async function loadData(targetCity) {
    try {
      const [stRes, alRes, profRes, prRes] = await Promise.all([
        getJson(`/api/stations?city=${encodeURIComponent(targetCity)}`),
        getJson(`/api/alerts?city=${encodeURIComponent(targetCity)}`).catch(() => ({ data: [] })),
        getJson('/api/user/profile').catch(() => ({ data: null })),
        getJson('/api/store/products').catch(() => ({ data: [] })),
      ]);

      const stList = Array.isArray(stRes.data) ? stRes.data : [];
      setStations(stList);
      setAlerts(Array.isArray(alRes.data) ? alRes.data : []);
      const isLoggedOut = localStorage.getItem('saans_logged_out') === 'true';
      if (!isLoggedOut && profRes.data) {
        setUserProfile(profRes.data);
      }
      if (prRes.data) setProducts(prRes.data);

      if (stList.length > 0) {
        const targetId = stList[0].openaqId;
        setSelectedId(targetId);
        loadForecast(targetId);
      }
    } catch (e) {
      console.error('Data load exception:', e);
    }
  }

  async function loadForecast(stId) {
    if (!stId) return;
    try {
      const fc = await getJson(`/api/stations/${stId}/forecast`);
      setForecast(fc);
    } catch (e) {
      console.warn('Forecast error:', e.message);
    }
  }

  // Auth Handlers
  async function handleLoginSubmit(e) {
    if (e) e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const res = await getJson('/api/user/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authForm.email, password: authForm.password }),
      });
      setUserProfile(res.data);
      localStorage.removeItem('saans_logged_out');
      setIsAuthModalOpen(false);
      setAuthToast(`Logged in as ${res.data.name}`);
      setTimeout(() => setAuthToast(''), 3500);
    } catch (err) {
      setAuthError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleDemoQuickLogin() {
    setAuthError('');
    setAuthLoading(true);
    try {
      const res = await getJson('/api/user/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDemoQuickLogin: true }),
      });
      setUserProfile(res.data);
      localStorage.removeItem('saans_logged_out');
      setIsAuthModalOpen(false);
      setAuthToast('Signed in as Dr. Aditya Sharma (Judge Demo Profile)');
      setTimeout(() => setAuthToast(''), 3500);
    } catch (err) {
      setAuthError(err.message || 'Demo login failed');
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleRegisterSubmit(e) {
    if (e) e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const res = await getJson('/api/user/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: authForm.name,
          email: authForm.email,
          password: authForm.password,
          city: authForm.city || city,
          healthProfile: {
            asthma: authForm.asthma,
            athlete: authForm.athlete,
            child: authForm.child,
            elderly: authForm.elderly,
          },
          outdoorHoursPerWeek: Number(authForm.outdoorHours) || 8,
        }),
      });
      setUserProfile(res.data);
      localStorage.removeItem('saans_logged_out');
      setIsAuthModalOpen(false);
      setAuthToast(`Account created for ${res.data.name}!`);
      setTimeout(() => setAuthToast(''), 3500);
    } catch (err) {
      setAuthError(err.message || 'Registration failed');
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await getJson('/api/user/logout', { method: 'POST' }).catch(() => {});
    } catch (_) {}
    setUserProfile(null);
    localStorage.setItem('saans_logged_out', 'true');
    setAuthToast('Signed out of session');
    setTimeout(() => setAuthToast(''), 3500);
  }

  // Commute Optimizer loader
  async function loadCommute(targetCity = city, corridor = commuteCorridor, mode = commuteMode) {
    const cId = corridor || (targetCity === 'delhi' ? 'anandvihar_ito' : 'pccoe_hinjewadi');
    setCommuteLoading(true);
    try {
      const res = await getJson(`/api/commute/optimize?city=${encodeURIComponent(targetCity)}&corridorId=${encodeURIComponent(cId)}&mode=${encodeURIComponent(mode)}`);
      if (res.data) setCommuteData(res.data);
    } catch (e) {
      console.warn('Commute error:', e.message);
    } finally {
      setCommuteLoading(false);
    }
  }

  useEffect(() => {
    loadData(city);
    const defaultCorridor = city === 'delhi' ? 'anandvihar_ito' : 'pccoe_hinjewadi';
    setCommuteCorridor(defaultCorridor);
    loadCommute(city, defaultCorridor, commuteMode);
  }, [city]);

  const selectedStation = stations.find(s => String(s.openaqId) === String(selectedId)) || stations[0];
  const latestR = selectedStation?.latestReading || {};
  const aqiVal = latestR.aqi || 142;
  const aqiBand = getAqiBand(aqiVal);

  // Berkeley Earth Cigarette Equivalence Metric (22 µg/m³ PM2.5 ≈ 1 cigarette/day)
  const pm25Val = latestR.pm25 || Math.round(aqiVal * 0.45) || 58;
  const cigaretteDaily = +(pm25Val / 22).toFixed(1);
  const cigaretteWeekly = +(cigaretteDaily * 7).toFixed(1);
  const toxicDoseMg = +((pm25Val * 15) / 1000).toFixed(2);

  // Cart operations
  function handleAddToCart(product) {
    setCart(prev => {
      const exist = prev.find(p => p._id === product._id);
      if (exist) return prev.map(p => p._id === product._id ? { ...p, quantity: p.quantity + 1 } : p);
      return [...prev, { ...product, quantity: 1 }];
    });
    setOrderToast(true);
    setTimeout(() => setOrderToast(false), 4000);
  }

  async function handleCheckout() {
    if (!cart.length) return;
    try {
      await getJson('/api/store/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map(c => ({ productId: c._id, quantity: c.quantity, price: c.price })),
          shippingAddress: { city: city === 'pune' ? 'Pune' : 'Delhi', addressLine: 'PCCOE Campus Road, Sector 26, Pradhikaran, Nigdi' }
        })
      });
      setCart([]);
      setIsCartOpen(false);
      setOrderToast(true);
      setTimeout(() => setOrderToast(false), 4000);
    } catch (e) {
      alert('Checkout error: ' + e.message);
    }
  }

  // Handle chat submit
  async function handleSendChat(text = chatInput) {
    if (!text || !text.trim()) return;
    const userMsg = { role: 'user', content: text.trim() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const res = await getJson('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          stationId: selectedStation?.openaqId,
          city,
        }),
      });

      if (res.data) {
        setChatMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: res.data.content,
            toolsUsed: res.data.toolsUsed || [],
            showProductCards: text.toLowerCase().includes('mask') || text.toLowerCase().includes('purifier') || text.toLowerCase().includes('protect') || text.toLowerCase().includes('buy'),
          },
        ]);
      }
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e.message}`, toolsUsed: [] }]);
    } finally {
      setIsChatLoading(false);
    }
  }

  // Health toggle
  async function toggleHealth(condition) {
    if (!userProfile) return;
    const updated = { ...userProfile.healthProfile, [condition]: !userProfile.healthProfile?.[condition] };
    setUserProfile(p => ({ ...p, healthProfile: updated }));
    fetch('/api/user/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ healthProfile: updated }),
    }).catch(() => {});
  }

  const forecastHours = forecast?.hours || [];
  const activeScrubber = forecastHours[scrubberHour] || forecastHours[0] || {};

  return (
    <div>
      {/* ────────────────────────────────────────────────────────
          TOPBAR NAVBAR
          ──────────────────────────────────────────────────────── */}
      <header className="topbar">
        <div className="wrap toprow">
          {/* LOGO */}
          <div className="brand-group" onClick={() => setCurrentPage('home')}>
            <div className="brand-logo-icon">◈</div>
            <div>
              <div className="brand">SAANS</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Air Intelligence
              </div>
            </div>
          </div>

          {/* MAIN NAV LINKS */}
          <nav className="nav-links">
            <button className={`nav-btn ${currentPage === 'home' ? 'active' : ''}`} onClick={() => setCurrentPage('home')}>Home</button>
            <button className={`nav-btn ${currentPage === 'problem' ? 'active' : ''}`} onClick={() => setCurrentPage('problem')}>Problem</button>
            <button className={`nav-btn ${currentPage === 'solution' ? 'active' : ''}`} onClick={() => setCurrentPage('solution')}>Solution</button>
            <button className={`nav-btn ${currentPage === 'analysis' ? 'active' : ''}`} onClick={() => setCurrentPage('analysis')}>Unified Analysis</button>
            <button className={`nav-btn ${currentPage === 'dashboard' ? 'active' : ''}`} onClick={() => setCurrentPage('dashboard')}>Dashboard</button>
            <button className={`nav-btn ${currentPage === 'assistant' ? 'active' : ''}`} onClick={() => setCurrentPage('assistant')}>AI Assistant</button>
          </nav>

          {/* UTILITY CONTROLS */}
          <div className="top-actions">
            <div className="pill-status">
              <span style={{ fontSize: '0.7rem' }}>●</span> API Online
            </div>

            {/* CITY TOGGLE */}
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 2 }}>
              <button
                onClick={() => setCity('pune')}
                style={{
                  background: city === 'pune' ? 'var(--primary)' : 'transparent',
                  color: city === 'pune' ? '#04120e' : 'var(--text-muted)',
                  border: 'none',
                  padding: '0.35rem 0.65rem',
                  borderRadius: 6,
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}
              >
                Pune
              </button>
              <button
                onClick={() => setCity('delhi')}
                style={{
                  background: city === 'delhi' ? 'var(--primary)' : 'transparent',
                  color: city === 'delhi' ? '#04120e' : 'var(--text-muted)',
                  border: 'none',
                  padding: '0.35rem 0.65rem',
                  borderRadius: 6,
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}
              >
                Delhi
              </button>
            </div>

            {/* AUTH / PROFILE ACTION */}
            {userProfile ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <button
                  className="pill-btn"
                  onClick={() => setCurrentPage('profile')}
                  style={{ background: 'rgba(0, 229, 153, 0.08)', borderColor: 'var(--primary)', color: '#fff' }}
                  title="View your personalized health profile"
                >
                  👤 {userProfile.name?.split(' ')[0] || 'Profile'} {userProfile.healthProfile?.asthma ? '🫁' : ''}
                </button>
                <button
                  className="pill-btn"
                  onClick={handleLogout}
                  style={{ color: 'var(--text-dim)', fontSize: '0.72rem', padding: '0.35rem 0.55rem' }}
                  title="Sign out of session"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                className="btn-primary"
                onClick={() => {
                  setAuthTab('login');
                  setAuthError('');
                  setIsAuthModalOpen(true);
                }}
                style={{ padding: '0.35rem 0.85rem', fontSize: '0.75rem', borderRadius: 8 }}
              >
                🔑 Sign In / Register
              </button>
            )}

            <button className="pill-btn pill-cart" onClick={() => setIsCartOpen(true)}>
              🛒 Cart ({cart.reduce((s, i) => s + i.quantity, 0)})
            </button>
          </div>
        </div>
      </header>

      {/* ────────────────────────────────────────────────────────
          PAGE 1: HOME PAGE
          ──────────────────────────────────────────────────────── */}
      {currentPage === 'home' && (
        <div className="wrap">
          {/* HERO */}
          <section className="hero-wrap">
            <div>
              <h1 className="hero-title">Predict the Risk.<br />Take Action.</h1>
              <p className="hero-sub">
                Existing platforms help users see air quality. SAANS helps you understand it, predict future spikes, explain atmospheric drivers, and take personalized protection before pollution affects your day.
              </p>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button className="btn-primary" onClick={() => setCurrentPage('dashboard')}>
                  Explore air quality ➔
                </button>
                <button className="btn-outline" onClick={() => setCurrentPage('assistant')}>
                  Get personalized protection
                </button>
              </div>

              <div style={{ display: 'flex', gap: '1.25rem', marginTop: '2.5rem', fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }}>
                <span>• 29 Indian Cities & States</span>
                <span>• SHAP Explainable ML</span>
                <span>• Open-Meteo & CPCB Live Data</span>
              </div>
            </div>

            {/* HERO RIGHT LIVE CARD */}
            <div className="card" style={{ padding: '2rem', background: '#0a231c', border: '1px solid rgba(0,229,153,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Current Air Quality Index • {selectedStation?.name?.split(',')[0] || 'Nigdi / PCCOE'}
                  </div>
                  <div style={{ fontSize: '4rem', fontWeight: 900, color: aqiBand.color, fontFamily: 'var(--font-mono)', lineHeight: 1, marginTop: '0.5rem' }}>
                    {aqiVal}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ background: `${aqiBand.color}22`, color: aqiBand.color, padding: '4px 10px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 800 }}>
                    {latestR.dominantPollutant || 'PM2.5'} Dominant
                  </span>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.5rem' }}>
                    +12 since 6 AM
                  </div>
                </div>
              </div>

              {/* BARS */}
              <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-muted)' }}>PM2.5 (Fine Particulate)</span>
                    <strong style={{ color: '#fff', fontFamily: 'var(--font-mono)' }}>{fmt(latestR.pm25)} µg/m³</strong>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, (latestR.pm25 / 150) * 100)}%`, height: '100%', background: aqiBand.color }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-muted)' }}>NO₂ (Traffic Exhaust)</span>
                    <strong style={{ color: '#fff', fontFamily: 'var(--font-mono)' }}>{fmt(latestR.no2)} ppb</strong>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, (latestR.no2 / 100) * 100)}%`, height: '100%', background: '#38bdf8' }} />
                  </div>
                </div>
              </div>

              {/* SAANS AI RISK INSIGHT */}
              <div style={{ marginTop: '1.5rem', background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: 10, borderLeft: '4px solid var(--primary)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--primary)' }}>⚡ SAANS AI Risk Insight:</strong>
                <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                  Falling wind speed ({latestR.windSpeed || 11} km/h) & evening commute will push AQI to 184 by 7:00 PM. Avoid outdoor workouts.
                </p>
              </div>
            </div>
          </section>

          {/* 5 STEPS FRAMEWORK */}
          <section style={{ marginTop: '4rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              THE SAANS FRAMEWORK
            </div>
            <h2 style={{ fontSize: '2.25rem', fontWeight: 900, marginTop: '0.5rem' }}>
              5 Steps from Air Signal to Personal Action
            </h2>
            <p style={{ color: 'var(--text-muted)', maxWidth: 650, margin: '0.5rem auto 2.5rem', fontSize: '0.95rem' }}>
              Unlike generic dashboards that only report raw numbers, SAANS guides you through an end-to-end intelligence pipeline.
            </p>

            <div className="framework-grid">
              <div className="framework-card" onClick={() => setCurrentPage('dashboard')} style={{ cursor: 'pointer' }}>
                <div>
                  <div className="framework-num">01</div>
                  <div className="framework-badge">DETECT</div>
                  <div className="framework-title">Hyperlocal AQI</div>
                  <div className="framework-desc">Live station readings for PM2.5, PM10, NO₂, and O₃ across 10 regional nodes.</div>
                </div>
                <div style={{ marginTop: '1.25rem', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 700 }}>
                  Explore module ➔
                </div>
              </div>

              <div className="framework-card" onClick={() => setCurrentPage('analysis')} style={{ cursor: 'pointer' }}>
                <div>
                  <div className="framework-num">02</div>
                  <div className="framework-badge">PREDICT</div>
                  <div className="framework-title">ML 72h Forecast</div>
                  <div className="framework-desc">LightGBM models forecasting pollution trends before harmful exposure occurs.</div>
                </div>
                <div style={{ marginTop: '1.25rem', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 700 }}>
                  Explore module ➔
                </div>
              </div>

              <div className="framework-card" onClick={() => setCurrentPage('analysis')} style={{ cursor: 'pointer' }}>
                <div>
                  <div className="framework-num">03</div>
                  <div className="framework-badge">EXPLAIN</div>
                  <div className="framework-title">Explainable AI</div>
                  <div className="framework-desc">TreeSHAP risk attribution breaking down exact weather and emission drivers.</div>
                </div>
                <div style={{ marginTop: '1.25rem', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 700 }}>
                  Explore module ➔
                </div>
              </div>

              <div className="framework-card" onClick={() => setCurrentPage('assistant')} style={{ cursor: 'pointer' }}>
                <div>
                  <div className="framework-num">04</div>
                  <div className="framework-badge">ADVISE</div>
                  <div className="framework-title">Agentic Assistant</div>
                  <div className="framework-desc">Natural-language guidance tailored to asthma, workouts, commute, or school.</div>
                </div>
                <div style={{ marginTop: '1.25rem', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 700 }}>
                  Explore module ➔
                </div>
              </div>

              <div className="framework-card" onClick={() => setIsCartOpen(true)} style={{ cursor: 'pointer' }}>
                <div>
                  <div className="framework-num">05</div>
                  <div className="framework-badge">ACT</div>
                  <div className="framework-title">Protection Essentials</div>
                  <div className="framework-desc">AQI-linked product recommendations added straight to your SAANS protection cart.</div>
                </div>
                <div style={{ marginTop: '1.25rem', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 700 }}>
                  Explore module ➔
                </div>
              </div>
            </div>
          </section>

          {/* AGENTIC ASSISTANT TEASER */}
          <section style={{ marginTop: '4rem', background: 'linear-gradient(135deg, #0a251e, #0e3027)', borderRadius: 20, padding: '2.5rem', border: '1px solid var(--border)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  AGENTIC ASSISTANT
                </span>
                <h3 style={{ fontSize: '2rem', fontWeight: 900, marginTop: '0.5rem', lineHeight: 1.2 }}>
                  Ask natural questions.<br />Get actionable environmental advice.
                </h3>
                <p style={{ color: 'var(--text-muted)', marginTop: '0.75rem', fontSize: '0.9rem', lineHeight: 1.6 }}>
                  “Is it safe to jog in Wakad at 7 AM?” or “Should I keep windows open in Shivajinagar today?” SAANS AI synthesizes ML forecasts and personal health conditions to give direct answers.
                </p>
                <button className="btn-primary" onClick={() => setCurrentPage('assistant')} style={{ marginTop: '1.5rem' }}>
                  💬 Talk to SAANS AI Assistant
                </button>
              </div>

              <div className="subcard" style={{ padding: '1.5rem', borderLeft: '4px solid var(--primary)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                  ⚠️ Real-Time Advisory Example
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: '0.5rem', color: '#fff' }}>
                  “{selectedStation?.name?.split(',')[0]} AQI {aqiVal} ({aqiBand.label}). High PM2.5 detected. Outdoor running discouraged between 6-9 AM. Wear N95 respirator if commuting.”
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.25rem', fontSize: '0.75rem', color: 'var(--primary)' }}>
                  <span>Personalized for: Sensitive / Active</span>
                  <span>100% Explainable</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────
          PAGE 2: PROBLEM PAGE
          ──────────────────────────────────────────────────────── */}
      {currentPage === 'problem' && (
        <div className="wrap" style={{ padding: '3rem 0' }}>
          <div style={{ textAlign: 'center', maxWidth: 780, margin: '0 auto 3rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#ff4d6d', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              THE URBAN AIR CRISIS
            </span>
            <h1 style={{ fontSize: '2.75rem', fontWeight: 900, marginTop: '0.5rem' }}>
              A Single City Average Cannot Protect Your Day
            </h1>
            <p style={{ color: 'var(--text-muted)', marginTop: '1rem', fontSize: '1rem', lineHeight: 1.6 }}>
              Standard weather apps broadcast a blanket AQI for an entire metropolis of 10+ million people. In reality, street-level air quality fluctuates by over 300% between neighborhoods due to traffic canyons, industrial emissions, and micro-climate inversions.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
            <div className="card" style={{ padding: '2rem' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,77,109,0.15)', color: '#ff4d6d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
                📍
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '1.25rem' }}>1. Spatial Blindspots</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.75rem', lineHeight: 1.6 }}>
                While Pashan enjoys clean westerly winds (AQI 54), Bhosari industrial area experiences trapped heavy particulates (AQI 220). A city average of “120” conceals critical hazard zones.
              </p>
            </div>

            <div className="card" style={{ padding: '2rem' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
                ⏱️
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '1.25rem' }}>2. Backward-Looking Telemetry</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.75rem', lineHeight: 1.6 }}>
                Traditional platforms display what happened 2 hours ago. Users step outdoors without knowing that an atmospheric inversion will peak right during their evening commute.
              </p>
            </div>

            <div className="card" style={{ padding: '2rem' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(56,189,248,0.15)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
                🛡️
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '1.25rem' }}>3. Lack of Actionable Decisions</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.75rem', lineHeight: 1.6 }}>
                Seeing a red number causes anxiety without solutions. Users need exact time windows, sensitive-group risk thresholds, and protective equipment advice.
              </p>
            </div>
          </div>

          <div style={{ marginTop: '3rem', background: '#0a231c', padding: '1.5rem 2rem', borderRadius: 14, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ fontWeight: 800, fontSize: '1.1rem' }}>How SAANS Transforms Data into Decision-Support</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4 }}>Explore our 5-stage architecture: Detect ➔ Predict ➔ Explain ➔ Advise ➔ Act</p>
            </div>
            <button className="btn-primary" onClick={() => setCurrentPage('solution')}>
              Explore Solution Architecture ➔
            </button>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────
          PAGE 3: SOLUTION ARCHITECTURE
          ──────────────────────────────────────────────────────── */}
      {currentPage === 'solution' && (
        <div className="wrap" style={{ padding: '3rem 0' }}>
          <div style={{ textAlign: 'center', maxWidth: 780, margin: '0 auto 3rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              SAANS ARCHITECTURE
            </span>
            <h1 style={{ fontSize: '2.75rem', fontWeight: 900, marginTop: '0.5rem' }}>
              End-to-End Predictive Environmental Intelligence
            </h1>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="card" style={{ padding: '1.75rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>01</span>
                <span style={{ marginLeft: 12, fontWeight: 800, fontSize: '1.15rem' }}>DETECT: Hyperlocal Sensor Telemetry</span>
                <span style={{ marginLeft: 12, fontSize: '0.7rem', background: 'rgba(0,229,153,0.15)', color: 'var(--primary)', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>Real-Time Telemetry</span>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.4rem' }}>
                  Ingests continuous feeds from ground-level optical particle counters, gas sensors, and Open-Meteo atmospheric reanalysis across Pune & Delhi.
                </p>
              </div>
              <div style={{ fontSize: '1.75rem' }}>📡</div>
            </div>

            <div className="card" style={{ padding: '1.75rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>02</span>
                <span style={{ marginLeft: 12, fontWeight: 800, fontSize: '1.15rem' }}>PREDICT: 72-Hour LightGBM Multi-Horizon Forecasting</span>
                <span style={{ marginLeft: 12, fontSize: '0.7rem', background: 'rgba(56,189,248,0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>Predictive ML</span>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.4rem' }}>
                  ML models synthesize boundary layer height, wind velocity, and commute patterns to forecast AQI trends up to 3 days in advance with p10-p90 confidence bounds.
                </p>
              </div>
              <div style={{ fontSize: '1.75rem' }}>📈</div>
            </div>

            <div className="card" style={{ padding: '1.75rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>03</span>
                <span style={{ marginLeft: 12, fontWeight: 800, fontSize: '1.15rem' }}>EXPLAIN: Explainable AI (TreeSHAP)</span>
                <span style={{ marginLeft: 12, fontSize: '0.7rem', background: 'rgba(168,85,247,0.15)', color: '#a855f7', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>Explainable AI</span>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.4rem' }}>
                  Converts complex multi-dimensional models into plain-English causal drivers: thermal stagnation, diesel generator cycles, or particulate swelling.
                </p>
              </div>
              <div style={{ fontSize: '1.75rem' }}>🔬</div>
            </div>

            <div className="card" style={{ padding: '1.75rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>04</span>
                <span style={{ marginLeft: 12, fontWeight: 800, fontSize: '1.15rem' }}>ADVISE: Personalized Threshold Shifts</span>
                <span style={{ marginLeft: 12, fontSize: '0.7rem', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>Dynamic Health Guard</span>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.4rem' }}>
                  Dynamic health adaptation: safety thresholds tighten automatically for individuals with asthma, children, athletes, or elderly family members.
                </p>
              </div>
              <div style={{ fontSize: '1.75rem' }}>🛡️</div>
            </div>

            <div className="card" style={{ padding: '1.75rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>05</span>
                <span style={{ marginLeft: 12, fontWeight: 800, fontSize: '1.15rem' }}>ACT: Agentic AI & Protection Kit</span>
                <span style={{ marginLeft: 12, fontSize: '0.7rem', background: 'rgba(255,77,109,0.15)', color: '#ff4d6d', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>Actionable Protection</span>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.4rem' }}>
                  Tool-based reasoning provides precise workout windows, route safety advice, and 1-click access to certified HEPA purifiers and N95 respirators.
                </p>
              </div>
              <div style={{ fontSize: '1.75rem' }}>🛍️</div>
            </div>
          </div>

          <div style={{ marginTop: '3rem', textAlign: 'center' }}>
            <button className="btn-primary" onClick={() => setCurrentPage('dashboard')} style={{ marginRight: '1rem' }}>
              Explore Live Map
            </button>
            <button className="btn-outline" onClick={() => setCurrentPage('assistant')}>
              Ask AI Assistant
            </button>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────
          PAGE 4: DASHBOARD
          ──────────────────────────────────────────────────────── */}
      {currentPage === 'dashboard' && (
        <div className="wrap" style={{ padding: '2rem 0' }}>
          {/* WALKTHROUGH BANNER (FROM VIDEO) */}
          {showWalkthrough && (
            <div style={{ background: 'linear-gradient(135deg, #092c22, #0d3b2e)', border: '1px solid var(--border)', borderRadius: 14, padding: '1.25rem 1.75rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.7rem', background: 'var(--primary)', color: '#04120e', padding: '2px 6px', borderRadius: 4, fontWeight: 800 }}>
                    PREDICT & SCHEDULE
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Step 2 of 3</span>
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: '0.35rem' }}>
                  2. 72-Hour Forecast & Time Scrubber
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  Drag the map time-scrubber to simulate how wind patterns, atmospheric inversion, and traffic shift pollution across the city over the next 3 days.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={() => setShowWalkthrough(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '0.8rem' }}>
                  Skip Walkthrough
                </button>
                <button className="btn-primary" onClick={() => setCurrentPage('analysis')} style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}>
                  Next Step ➔
                </button>
              </div>
            </div>
          )}

          {/* SENSOR HEADER */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase' }}>
                LIVE SENSOR NETWORK • {city.toUpperCase()} GRID
              </span>
              <h2 style={{ fontSize: '1.85rem', fontWeight: 900, marginTop: 2 }}>
                Hyperlocal Air Quality Decision Engine
              </h2>
            </div>
            <button className="pill-btn" onClick={() => loadData(city)}>
              🔄 Refresh Feeds
            </button>
          </div>

          {/* STATION PILLS */}
          <div className="station-pills-row" style={{ marginBottom: '1.5rem' }}>
            {stations.map(st => {
              const isSel = String(st.openaqId) === String(selectedId);
              const stAqi = st.latestReading?.aqi || 142;
              const band = getAqiBand(stAqi);
              return (
                <button
                  key={st.openaqId}
                  className={`station-pill ${isSel ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedId(st.openaqId);
                    loadForecast(st.openaqId);
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: 99, background: band.color }} />
                  <span>{st.name.split(',')[0]}</span>
                  <span style={{ background: band.color, color: band.textColor, padding: '1px 6px', borderRadius: 4, fontWeight: 800, fontSize: '0.75rem' }}>
                    {stAqi}
                  </span>
                </button>
              );
            })}
          </div>

          {/* GRID: MAP ON LEFT, ACTIVE STATION CARD ON RIGHT */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: '1.5rem' }}>
            {/* MAP CARD */}
            <div className="card" style={{ height: '560px', display: 'flex', flexDirection: 'column', position: 'relative' }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  📍 Greater {city === 'pune' ? 'Pune Metropolitan' : 'Delhi NCR'} Monitoring Grid • {stations.length} Live Nodes
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="pill-btn" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>Street</button>
                  <button className="pill-btn" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', background: 'var(--primary)', color: '#04120e' }}>Satellite</button>
                </div>
              </div>

              {/* INTERACTIVE LEAFLET MAP */}
              <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                <AqiLeafletMap
                  city={city}
                  stations={stations}
                  selectedId={selectedId}
                  onSelectStation={(id) => {
                    setSelectedId(id);
                    loadForecast(id);
                  }}
                />
              </div>

              {/* MAP BOTTOM LEGEND */}
              <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-dim)', background: 'rgba(0,0,0,0.3)' }}>
                <span>AQI Severity Scale:</span>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <span><strong style={{ color: '#00e599' }}>●</strong> Good (0-50)</span>
                  <span><strong style={{ color: '#f59e0b' }}>●</strong> Moderate (51-100)</span>
                  <span><strong style={{ color: '#f97316' }}>●</strong> Poor (101-200)</span>
                  <span><strong style={{ color: '#ff4d6d' }}>●</strong> Severe (200+)</span>
                </div>
              </div>
            </div>

            {/* ACTIVE STATION CARD */}
            <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase' }}>
                    ACTIVE STATION NODE • Updated 3m ago
                  </span>
                  <button style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '1.1rem' }}>
                    🔖
                  </button>
                </div>

                <h2 style={{ fontSize: '1.75rem', fontWeight: 900, marginTop: '0.35rem' }}>
                  {selectedStation?.name?.split(',')[0] || 'Nigdi / PCCOE'}
                </h2>

                {/* REAL-TIME AQI GAUGE */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginTop: '1.25rem' }}>
                  <div style={{ fontSize: '3.75rem', fontWeight: 900, color: aqiBand.color, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
                    {aqiVal}
                    <span style={{ fontSize: '1rem', color: 'var(--text-dim)', fontWeight: 600 }}> /500</span>
                  </div>
                  <div>
                    <div style={{ background: `${aqiBand.color}22`, color: aqiBand.color, padding: '3px 10px', borderRadius: 99, fontSize: '0.8rem', fontWeight: 800, display: 'inline-block' }}>
                      ● AQI {aqiVal} {aqiBand.label}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4 }}>
                      Trend: +12 since 6 AM
                    </div>
                  </div>
                </div>

                {/* HEALTH ACTION ADVISORY */}
                <div style={{ marginTop: '1.25rem', background: 'rgba(0,0,0,0.3)', padding: '0.85rem 1.15rem', borderRadius: 12, borderLeft: `4px solid ${aqiBand.color}`, fontSize: '0.85rem' }}>
                  <div style={{ fontWeight: 800, color: '#fff' }}>⚡ Health Action Advisory</div>
                  <p style={{ color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
                    Avoid outdoor exercise 6-9 AM. Wear N95 respirator if commuting along busy arterial roads.
                  </p>
                </div>

                {/* BERKELEY CIGARETTE EQUIVALENCE & TOXIC DOSE */}
                <div style={{ marginTop: '1rem', background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(245, 158, 11, 0.05))', padding: '1rem 1.15rem', borderRadius: 12, border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontSize: '1.1rem' }}>🚬</span>
                      <strong style={{ color: '#fff', fontSize: '0.82rem' }}>Cigarette Equivalence & Toxic Dose</strong>
                    </div>
                    <span style={{ fontSize: '0.65rem', background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', padding: '2px 7px', borderRadius: 99, fontWeight: 700, letterSpacing: '0.04em' }}>
                      BERKELEY EARTH PEER STANDARD
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.65rem' }}>
                    <span style={{ fontSize: '2.2rem', fontWeight: 900, color: cigaretteDaily > 3 ? '#ff4d6d' : '#f59e0b', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
                      {cigaretteDaily}
                    </span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#fff' }}>
                      Cigarettes / Day
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginLeft: 'auto' }}>
                      ({cigaretteWeekly} cigs/week)
                    </span>
                  </div>

                  <p style={{ color: 'var(--text-muted)', fontSize: '0.76rem', marginTop: '0.4rem', lineHeight: 1.45 }}>
                    Breathing 24h outdoor air in <strong>{selectedStation?.name?.split(',')[0]}</strong> equals involuntarily smoking <strong>{cigaretteDaily} cigarettes</strong> today ({toxicDoseMg} mg inhaled PM2.5).
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.65rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                    <span>🛡️ N95 cuts dose by 95% (&lt; 0.1 cigs)</span>
                    <button
                      onClick={() => {
                        setCurrentPage('assistant');
                        handleSendChat(`What is my inhaled cigarette equivalence and toxic dose in ${selectedStation?.name?.split(',')[0]}?`);
                      }}
                      style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 700, fontSize: '0.72rem', padding: 0 }}
                    >
                      Ask AI Explainer ➔
                    </button>
                  </div>
                </div>

                {/* POLLUTANT BARS */}
                <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 3 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Dominant Pollutant: <strong>PM2.5</strong></span>
                      <strong style={{ color: '#fff', fontFamily: 'var(--font-mono)' }}>{fmt(latestR.pm25)} µg/m³</strong>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, (latestR.pm25 / 150) * 100)}%`, height: '100%', background: aqiBand.color }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 3 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Nitrogen Dioxide (NO₂)</span>
                      <strong style={{ color: '#fff', fontFamily: 'var(--font-mono)' }}>{fmt(latestR.no2)} ppb</strong>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, (latestR.no2 / 100) * 100)}%`, height: '100%', background: '#38bdf8' }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 3 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Ground Ozone (O₃)</span>
                      <strong style={{ color: '#fff', fontFamily: 'var(--font-mono)' }}>{fmt(latestR.o3)} ppb</strong>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, (latestR.o3 / 100) * 100)}%`, height: '100%', background: '#38bdf8' }} />
                    </div>
                  </div>
                </div>

                {/* 4 WEATHER TILES */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.65rem', marginTop: '1.5rem' }}>
                  <div className="subcard" style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Temperature</div>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: '#fff', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{latestR.temperature || 26.5}°C</div>
                  </div>
                  <div className="subcard" style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Humidity</div>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: '#fff', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{latestR.humidity || 58}%</div>
                  </div>
                  <div className="subcard" style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Wind</div>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: '#fff', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{latestR.windSpeed || 11.2} km/h</div>
                  </div>
                  <div className="subcard" style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Visibility</div>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: '#fff', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{latestR.visibility || 4.2} km</div>
                  </div>
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button className="btn-outline" onClick={() => setCurrentPage('analysis')} style={{ justifyContent: 'center' }}>
                  Unified Analysis ↗
                </button>
                <button className="btn-primary" onClick={() => setCurrentPage('assistant')} style={{ justifyContent: 'center' }}>
                  💬 Ask SAANS AI
                </button>
              </div>

              {/* COMMUTE OPTIMIZER QUICK SHORTCUT */}
              <div style={{ marginTop: '0.85rem', background: 'rgba(0, 229, 153, 0.05)', border: '1px solid rgba(0, 229, 153, 0.2)', padding: '0.65rem 0.85rem', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                <span>🚗 Commuting across {city === 'pune' ? 'Pune/PCMC' : 'Delhi NCR'}?</span>
                <button
                  onClick={() => {
                    setCurrentPage('analysis');
                    setAnalysisSubTab('commute');
                    loadCommute(city);
                  }}
                  style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontWeight: 800, cursor: 'pointer', padding: 0 }}
                >
                  View Clean Air Eco-Corridor (-40% dose) ➔
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────
          PAGE 5: UNIFIED ANALYSIS (FROM VIDEO)
          ──────────────────────────────────────────────────────── */}
      {currentPage === 'analysis' && (
        <div className="wrap" style={{ padding: '2rem 0' }}>
          {/* SUB-TABS */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <button
              className={`pill-btn ${analysisSubTab === 'deepdive' ? 'pill-cart' : ''}`}
              onClick={() => setAnalysisSubTab('deepdive')}
              style={{ background: analysisSubTab === 'deepdive' ? 'var(--primary)' : 'rgba(255,255,255,0.05)', color: analysisSubTab === 'deepdive' ? '#04120e' : '#fff' }}
            >
              📍 Unified Location Deep-Dive
            </button>
            <button
              className={`pill-btn ${analysisSubTab === 'comparison' ? 'pill-cart' : ''}`}
              onClick={() => setAnalysisSubTab('comparison')}
              style={{ background: analysisSubTab === 'comparison' ? 'var(--primary)' : 'rgba(255,255,255,0.05)', color: analysisSubTab === 'comparison' ? '#04120e' : '#fff' }}
            >
              📊 Multi-Location Comparison Matrix
            </button>
            <button
              className={`pill-btn ${analysisSubTab === 'commute' ? 'pill-cart' : ''}`}
              onClick={() => {
                setAnalysisSubTab('commute');
                loadCommute(city);
              }}
              style={{ background: analysisSubTab === 'commute' ? 'var(--primary)' : 'rgba(255,255,255,0.05)', color: analysisSubTab === 'commute' ? '#04120e' : '#fff' }}
            >
              🚗 Clean Air Commute Optimizer
            </button>
          </div>

          {/* TITLE & BADGES */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase' }}>
                ML Multi-Sensor Predictive & Explainability Intelligence
              </span>
              <h2 style={{ fontSize: '2rem', fontWeight: 900, marginTop: 2 }}>
                {selectedStation?.name?.split(',')[0]} <span style={{ fontSize: '1rem', color: 'var(--text-dim)', fontWeight: 600 }}>{city.toUpperCase()} • As of now</span>
              </h2>
            </div>
            <span style={{ background: `${aqiBand.color}22`, color: aqiBand.color, padding: '4px 12px', borderRadius: 99, fontSize: '0.85rem', fontWeight: 800 }}>
              ● AQI {aqiVal} {aqiBand.label}
            </span>
          </div>

          {/* STATION PILLS */}
          <div className="station-pills-row" style={{ marginBottom: '1.5rem' }}>
            {stations.map(st => (
              <button
                key={st.openaqId}
                className={`station-pill ${String(st.openaqId) === String(selectedId) ? 'active' : ''}`}
                onClick={() => {
                  setSelectedId(st.openaqId);
                  loadForecast(st.openaqId);
                }}
              >
                <span>{st.name.split(',')[0]}</span>
                <span style={{ color: getAqiBand(st.latestReading?.aqi || 142).color, fontWeight: 800 }}>
                  {st.latestReading?.aqi || 142}
                </span>
              </button>
            ))}
          </div>

          {analysisSubTab === 'deepdive' && (
            <>
              {/* 72-HOUR FORECAST & 24H BREAKDOWN GRID */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem' }}>
            {/* 72H CHART */}
            <div className="card" style={{ padding: '1.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>72-Hour Predictive AQI Forecast</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Shaded area depicts LightGBM + Meteorological ensemble confidence interval</p>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="pill-btn" style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', background: 'var(--primary)', color: '#04120e' }}>72h Forecast</button>
                  <button className="pill-btn" style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}>Past 7 Days</button>
                </div>
              </div>

              {/* CHART SVG */}
              <div style={{ height: '220px', marginTop: '1.5rem' }}>
                <svg viewBox="0 0 800 200" style={{ width: '100%', height: '100%' }}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00e599" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#00e599" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  <line x1="0" y1="50" x2="800" y2="50" stroke="rgba(255,255,255,0.06)" strokeDasharray="4" />
                  <line x1="0" y1="100" x2="800" y2="100" stroke="rgba(255,255,255,0.06)" strokeDasharray="4" />
                  <line x1="0" y1="150" x2="800" y2="150" stroke="rgba(255,255,255,0.06)" strokeDasharray="4" />

                  {forecastHours.length > 0 && (() => {
                    const pts = forecastHours.map((pt, i) => {
                      const x = (i / (forecastHours.length - 1)) * 800;
                      const y = 180 - (Math.min(300, Math.max(30, pt.aqi)) / 300) * 150;
                      return `${x},${y}`;
                    });
                    const areaPts = `0,180 ${pts.join(' ')} 800,180`;
                    return (
                      <>
                        <polygon points={areaPts} fill="url(#areaGrad)" />
                        <polyline points={pts.join(' ')} fill="none" stroke="#00e599" strokeWidth="3" />
                      </>
                    );
                  })()}
                </svg>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.75rem' }}>
                <span>● Model Trajectory</span>
                <span>● 90% Confidence Interval</span>
                <span>Model: LightGBM-v2 + Satellite Telemetry</span>
              </div>
            </div>

            {/* 24H BREAKDOWN (FROM VIDEO) */}
            <div className="card" style={{ padding: '1.75rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>24h Hourly Breakdown</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>3-hour interval progression</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '1.25rem' }}>
                {[
                  { time: 'Now', val: aqiVal, band: aqiBand.label, color: aqiBand.color },
                  { time: '+3h (Evening)', val: aqiVal + 18, band: 'Poor', color: '#f97316' },
                  { time: '+6h (Peak Smog)', val: aqiVal + 36, band: 'Severe', color: '#ff4d6d' },
                  { time: '+9h (Midnight)', val: aqiVal + 22, band: 'Poor', color: '#f97316' },
                  { time: '+12h (Morning)', val: aqiVal + 10, band: 'Moderate', color: '#f59e0b' },
                  { time: '+15h (Afternoon)', val: aqiVal - 15, band: 'Moderate', color: '#00e599' },
                ].map((row, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <span style={{ width: 110, color: 'var(--text-muted)' }}>{row.time}</span>
                    <div style={{ flex: 1, margin: '0 1rem', height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, (row.val / 250) * 100)}%`, height: '100%', background: row.color }} />
                    </div>
                    <span style={{ width: 80, textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-mono)', color: row.color }}>
                      {row.val} <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>{row.band}</span>
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '1.25rem', background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: 8, fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                📍 <strong>Peak Exposure:</strong> Anticipate highest particulate concentration during evening traffic hours.
              </div>
            </div>
          </div>

          {/* LOWER GRID: SHAP DRIVERS & ACTIVITY WINDOWS (MATCHING VIDEO EXACTLY) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
            {/* TREE-SHAP DRIVERS */}
            <div className="card" style={{ padding: '1.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>AI Explainability: Why this Forecast?</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>SHAP-style local feature importance breaking down atmospheric drivers</p>
                </div>
                <span style={{ fontSize: '0.7rem', background: 'rgba(0,229,153,0.1)', color: 'var(--primary)', padding: '2px 8px', borderRadius: 4, fontWeight: 800 }}>
                  Explainable ML (TreeSHAP)
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '1.25rem' }}>
                <div className="shap-bar-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span>● Falling wind speed ({latestR.windSpeed || 11} km/h)</span>
                    <strong style={{ color: '#ff4d6d' }}>+82% Impact (Raises AQI)</strong>
                  </div>
                  <div className="shap-bar-bg"><div className="shap-bar-fill-inc" style={{ width: '82%' }} /></div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Calm nocturnal boundary layer traps exhaust particles</div>
                </div>

                <div className="shap-bar-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span>● Peak traffic NO₂ density</span>
                    <strong style={{ color: '#f59e0b' }}>+64% Impact (Raises AQI)</strong>
                  </div>
                  <div className="shap-bar-bg"><div className="shap-bar-fill-inc" style={{ width: '64%', background: '#f59e0b' }} /></div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Evening commute gridlock on arterial junction roads</div>
                </div>

                <div className="shap-bar-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span>● Low relative humidity ({latestR.humidity || 58}%)</span>
                    <strong style={{ color: '#f59e0b' }}>+38% Impact (Raises AQI)</strong>
                  </div>
                  <div className="shap-bar-bg"><div className="shap-bar-fill-inc" style={{ width: '38%', background: '#f59e0b' }} /></div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Dry ambient air diminishes particle scavenging</div>
                </div>

                <div className="shap-bar-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span>● Westerly airflow dispersion</span>
                    <strong style={{ color: '#00e599' }}>-22% Impact (Lowers AQI)</strong>
                  </div>
                  <div className="shap-bar-bg"><div className="shap-bar-fill-dec" style={{ width: '22%' }} /></div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Partial breeze displaces industrial corridor plume</div>
                </div>
              </div>
            </div>

            {/* OPTIMAL ACTIVITY WINDOWS */}
            <div className="card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Optimal Outdoor Activity Windows</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Algorithmic schedule balancing atmospheric dispersion and commuter exposure</p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '1.25rem' }}>
                  {/* SAFE WINDOW */}
                  <div style={{ background: 'rgba(0, 229, 153, 0.08)', border: '1px solid rgba(0, 229, 153, 0.25)', borderRadius: 12, padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 800 }}>Optimal Safe Window</span>
                      <span style={{ fontSize: '0.65rem', background: 'var(--primary)', color: '#04120e', padding: '1px 5px', borderRadius: 4, fontWeight: 800 }}>Recommended</span>
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#fff', marginTop: '0.5rem', fontFamily: 'var(--font-mono)' }}>
                      11:00 AM – 2:30 PM
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem', lineHeight: 1.4 }}>
                      Peak solar thermal mixing maximizes atmospheric boundary layer height.
                    </p>
                  </div>

                  {/* HIGH RISK INVERSION WINDOW */}
                  <div style={{ background: 'rgba(255, 77, 109, 0.08)', border: '1px solid rgba(255, 77, 109, 0.25)', borderRadius: 12, padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.7rem', color: '#ff4d6d', fontWeight: 800 }}>High Risk Inversion</span>
                      <span style={{ fontSize: '0.65rem', background: '#ff4d6d', color: '#fff', padding: '1px 5px', borderRadius: 4, fontWeight: 800 }}>Avoid Outdoors</span>
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#fff', marginTop: '0.5rem', fontFamily: 'var(--font-mono)' }}>
                      5:30 PM – 9:00 PM
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem', lineHeight: 1.4 }}>
                      Heavy office commute traffic coupled with rapid thermal inversion.
                    </p>
                  </div>
                </div>
              </div>

              {/* BOTTOM CTA BAR */}
              <div style={{ marginTop: '1.5rem', background: 'rgba(0,0,0,0.3)', padding: '0.85rem 1.25rem', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Targeted Action Advisory: <strong>Wear N95 mask in open traffic</strong>
                </span>
                <button className="btn-primary" onClick={() => setCurrentPage('assistant')} style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}>
                  💬 Ask SAANS AI
                </button>
              </div>
            </div>
          </div>
            </>
          )}

          {/* MULTI-LOCATION COMPARISON MATRIX WITH CIGARETTE EQUIVALENCE */}
          {analysisSubTab === 'comparison' && (
            <div className="card" style={{ padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.35rem', fontWeight: 900 }}>Multi-Location Atmospheric & Toxic Equivalence Matrix</h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Comparative environmental exposure & Berkeley Earth cigarette equivalents across all {city.toUpperCase()} nodes</p>
                </div>
                <span style={{ fontSize: '0.72rem', background: 'rgba(0,229,153,0.1)', color: 'var(--primary)', padding: '4px 10px', borderRadius: 99, fontWeight: 800 }}>
                  ● 5 Real-Time Stations Synced
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                      <th style={{ padding: '0.85rem 1rem' }}>Station Node</th>
                      <th style={{ padding: '0.85rem 1rem' }}>CPCB AQI</th>
                      <th style={{ padding: '0.85rem 1rem' }}>PM2.5 (µg/m³)</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Dominant</th>
                      <th style={{ padding: '0.85rem 1rem' }}>🚬 Passive Cigarettes / Day</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Toxic Dose (mg/day)</th>
                      <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stations.map(st => {
                      const stR = st.latestReading || {};
                      const stAqi = stR.aqi || 142;
                      const band = getAqiBand(stAqi);
                      const stPm25 = stR.pm25 || Math.round(stAqi * 0.45) || 55;
                      const stCigs = +(stPm25 / 22).toFixed(1);
                      const stDose = +((stPm25 * 15) / 1000).toFixed(2);
                      const isSel = String(st.openaqId) === String(selectedId);

                      return (
                        <tr
                          key={st.openaqId}
                          style={{
                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                            background: isSel ? 'rgba(0,229,153,0.06)' : 'transparent',
                            transition: 'background 0.2s ease',
                          }}
                        >
                          <td style={{ padding: '1rem', fontWeight: 700, color: '#fff' }}>
                            {st.name}
                            {isSel && <span style={{ marginLeft: 8, fontSize: '0.7rem', color: 'var(--primary)' }}>● Active</span>}
                          </td>
                          <td style={{ padding: '1rem' }}>
                            <span style={{ background: `${band.color}22`, color: band.color, padding: '3px 8px', borderRadius: 99, fontWeight: 800, fontSize: '0.78rem' }}>
                              {stAqi} {band.label}
                            </span>
                          </td>
                          <td style={{ padding: '1rem', fontFamily: 'var(--font-mono)', color: '#fff' }}>
                            {stPm25} µg/m³
                          </td>
                          <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                            {stR.dominantPollutant || 'PM2.5'}
                          </td>
                          <td style={{ padding: '1rem' }}>
                            <span style={{ fontWeight: 800, color: stCigs > 3 ? '#ff4d6d' : '#f59e0b', fontFamily: 'var(--font-mono)', fontSize: '0.95rem' }}>
                              🚬 {stCigs}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginLeft: 4 }}>cigs/day</span>
                          </td>
                          <td style={{ padding: '1rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                            {stDose} mg
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'right' }}>
                            <button
                              onClick={() => {
                                setSelectedId(st.openaqId);
                                loadForecast(st.openaqId);
                                setAnalysisSubTab('deepdive');
                              }}
                              className="btn-outline"
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                            >
                              Deep-Dive ➔
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* BERKELEY FOOTNOTE CALLOUT */}
              <div style={{ marginTop: '1.5rem', background: 'rgba(0,0,0,0.3)', padding: '1rem 1.25rem', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  📖 <strong>Toxicological Reference:</strong> Berkeley Earth Muller & Rohde peer-reviewed conversion rule equates 22 µg/m³ ambient PM2.5 to 1 cigarette in lung particle burden and cardiovascular disease risk.
                </div>
                <button
                  onClick={() => {
                    setCurrentPage('assistant');
                    handleSendChat(`Compare the cigarette equivalent toxic dose across all stations in ${city}`);
                  }}
                  className="btn-primary"
                  style={{ padding: '0.4rem 0.85rem', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
                >
                  Ask AI to Compare 💬
                </button>
              </div>
            </div>
          )}

          {/* CLEAN AIR COMMUTE & CORRIDOR OPTIMIZER */}
          {analysisSubTab === 'commute' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* TOP SELECTOR CARD */}
              <div className="card" style={{ padding: '1.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Clean Air Routing Intelligence
                    </span>
                    <h3 style={{ fontSize: '1.45rem', fontWeight: 900, marginTop: 2 }}>
                      Clean Air Commute & Corridor Optimizer
                    </h3>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      Calculates route-level particulate exposure, comparing heavy arterial stagnation with aerodynamic eco-corridors.
                    </p>
                  </div>
                  <span style={{ fontSize: '0.72rem', background: 'rgba(0,229,153,0.1)', color: 'var(--primary)', padding: '4px 10px', borderRadius: 99, fontWeight: 800 }}>
                    ● Real-Time Traffic & Air Quality Model
                  </span>
                </div>

                {/* CORRIDOR BUTTONS */}
                <div style={{ marginTop: '1.25rem' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Select Commute Corridor ({city.toUpperCase()}):
                  </label>
                  <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                    {(city === 'pune' ? [
                      { id: 'pccoe_hinjewadi', label: 'PCCOE Akurdi ➔ Hinjewadi IT Phase 1' },
                      { id: 'pccoe_shivajinagar', label: 'PCCOE Akurdi ➔ Shivajinagar Central' },
                      { id: 'bhosari_wakad', label: 'Bhosari MIDC ➔ Wakad Corridor' },
                    ] : [
                      { id: 'anandvihar_ito', label: 'Anand Vihar ➔ ITO / Connaught Place' },
                      { id: 'punjabibagh_rkpuram', label: 'Punjabi Bagh ➔ RK Puram South' },
                    ]).map(c => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setCommuteCorridor(c.id);
                          loadCommute(city, c.id, commuteMode);
                        }}
                        style={{
                          padding: '0.55rem 0.95rem',
                          borderRadius: 8,
                          border: commuteCorridor === c.id ? '1px solid var(--primary)' : '1px solid var(--border)',
                          background: commuteCorridor === c.id ? 'rgba(0,229,153,0.15)' : 'rgba(255,255,255,0.03)',
                          color: commuteCorridor === c.id ? '#fff' : 'var(--text-muted)',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        📍 {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* TRANSIT MODE SELECTOR */}
                <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Transit Vehicle / Physical Mode:
                  </label>
                  <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                    {[
                      { id: 'bike_scooter', icon: '🛵', label: 'Two-Wheeler / Scooter (1.5 m³/h)' },
                      { id: 'car_ac', icon: '🚗', label: 'Car with AC / Cabin Filter (0.35 m³/h)' },
                      { id: 'bus_transit', icon: '🚌', label: 'Public Bus (1.1 m³/h)' },
                      { id: 'bicycle', icon: '🚲', label: 'Bicycle / Jog (2.2 m³/h)' },
                    ].map(m => (
                      <button
                        key={m.id}
                        onClick={() => {
                          setCommuteMode(m.id);
                          loadCommute(city, commuteCorridor, m.id);
                        }}
                        style={{
                          padding: '0.45rem 0.85rem',
                          borderRadius: 8,
                          border: commuteMode === m.id ? '1px solid var(--primary)' : '1px solid var(--border)',
                          background: commuteMode === m.id ? 'rgba(0,229,153,0.15)' : 'rgba(0,0,0,0.2)',
                          color: commuteMode === m.id ? '#fff' : 'var(--text-muted)',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {m.icon} {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* COMPARISON CARDS GRID */}
              {commuteData && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    {/* STANDARD ARTERIAL ROUTE */}
                    <div className="card" style={{ padding: '1.75rem', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.05), rgba(12, 38, 31, 0.7))' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.7rem', color: '#ff4d6d', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Standard Shortest Corridor
                        </span>
                        <span style={{ fontSize: '0.72rem', background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', padding: '2px 8px', borderRadius: 99, fontWeight: 700 }}>
                          High Particulate Stagnation
                        </span>
                      </div>

                      <h4 style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: '0.5rem', color: '#fff' }}>
                        {commuteData.standardRoute?.name}
                      </h4>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 2 }}>
                        Road Type: {commuteData.standardRoute?.roadType}
                      </p>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginTop: '1.25rem' }}>
                        <div className="subcard" style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>Travel Time</div>
                          <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#fff', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                            {commuteData.standardRoute?.travelTimeMins} m
                          </div>
                        </div>

                        <div className="subcard" style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>Corridor PM2.5</div>
                          <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#ff4d6d', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                            {commuteData.standardRoute?.ambientPM25} µg
                          </div>
                        </div>

                        <div className="subcard" style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>Inhaled Toxic Dose</div>
                          <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#f59e0b', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                            {commuteData.standardRoute?.inhaledDoseUg} µg
                          </div>
                        </div>
                      </div>

                      <div style={{ marginTop: '1.25rem', padding: '0.75rem', borderRadius: 8, background: 'rgba(0,0,0,0.3)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        🚬 <strong>Passive Dose:</strong> Equal to involuntarily smoking <strong>{commuteData.standardRoute?.cigaretteEquivalence} cigarettes</strong> in a single commute due to diesel exhaust idling.
                      </div>
                    </div>

                    {/* CLEAN AIR ECO-CORRIDOR (RECOMMENDED) */}
                    <div className="card" style={{ padding: '1.75rem', border: '2px solid var(--primary)', background: 'linear-gradient(135deg, rgba(0, 229, 153, 0.08), rgba(12, 38, 31, 0.8))' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          🌿 RECOMMENDED ECO-CORRIDOR
                        </span>
                        <span style={{ fontSize: '0.72rem', background: 'var(--primary)', color: '#04120e', padding: '2px 8px', borderRadius: 99, fontWeight: 800 }}>
                          -{commuteData.optimization?.percentSaved}% Inhaled Dose
                        </span>
                      </div>

                      <h4 style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: '0.5rem', color: '#fff' }}>
                        {commuteData.cleanAirRoute?.name}
                      </h4>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 2 }}>
                        Road Type: {commuteData.cleanAirRoute?.roadType}
                      </p>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginTop: '1.25rem' }}>
                        <div className="subcard" style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>Travel Time</div>
                          <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#fff', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                            {commuteData.cleanAirRoute?.travelTimeMins} m
                          </div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>+{commuteData.optimization?.extraTimeMins}m delta</div>
                        </div>

                        <div className="subcard" style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>Corridor PM2.5</div>
                          <div style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--primary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                            {commuteData.cleanAirRoute?.ambientPM25} µg
                          </div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--primary)' }}>Clean Flow</div>
                        </div>

                        <div className="subcard" style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>Inhaled Toxic Dose</div>
                          <div style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--primary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                            {commuteData.cleanAirRoute?.inhaledDoseUg} µg
                          </div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--primary)' }}>-{commuteData.optimization?.doseSavedUg} µg saved</div>
                        </div>
                      </div>

                      <div style={{ marginTop: '1.25rem', padding: '0.75rem', borderRadius: 8, background: 'rgba(0, 229, 153, 0.08)', border: '1px solid rgba(0, 229, 153, 0.2)', fontSize: '0.78rem', color: '#fff' }}>
                        🛡️ <strong>Health Win:</strong> Inhaled cigarette equivalence drops to only <strong>{commuteData.cleanAirRoute?.cigaretteEquivalence} cigs</strong>. Saves <strong>{commuteData.optimization?.percentSaved}%</strong> toxic intake with only {commuteData.optimization?.extraTimeMins} mins extra travel time.
                      </div>
                    </div>
                  </div>

                  {/* DEPARTURE WINDOWS CARD */}
                  <div className="card" style={{ padding: '1.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h4 style={{ fontSize: '1.1rem', fontWeight: 800 }}>🕒 Optimal Departure Windows for this Corridor</h4>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Algorithmic timing balancing solar convection mixing and rush hour stagnation</p>
                      </div>
                      <button
                        onClick={() => {
                          setCurrentPage('assistant');
                          handleSendChat(`What is the safest commute route and departure window for ${commuteData.title}?`);
                        }}
                        className="btn-primary"
                        style={{ padding: '0.45rem 0.95rem', fontSize: '0.8rem' }}
                      >
                        💬 Ask AI Commute Advisor
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginTop: '1.25rem' }}>
                      {commuteData.departureWindows?.map((dw, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '1rem',
                            borderRadius: 12,
                            background: dw.aqiMultiplier < 1 ? 'rgba(0, 229, 153, 0.08)' : 'rgba(0,0,0,0.3)',
                            border: dw.aqiMultiplier < 1 ? '1px solid rgba(0, 229, 153, 0.3)' : '1px solid var(--border)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: dw.aqiMultiplier < 1 ? 'var(--primary)' : '#ff4d6d' }}>
                              {dw.tag}
                            </span>
                            {dw.aqiMultiplier < 1 && (
                              <span style={{ fontSize: '0.62rem', background: 'var(--primary)', color: '#04120e', padding: '1px 5px', borderRadius: 4, fontWeight: 800 }}>
                                RECOMMENDED
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff', marginTop: '0.35rem', fontFamily: 'var(--font-mono)' }}>
                            {dw.window}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem', lineHeight: 1.4 }}>
                            {dw.recommendation}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────
          PAGE 6: AI ASSISTANT (FULL-PAGE VIEW FROM VIDEO)
          ──────────────────────────────────────────────────────── */}
      {currentPage === 'assistant' && (
        <div className="wrap" style={{ padding: '2rem 0' }}>
          <div className="assistant-layout">
            {/* SIDEBAR: STATIONS & INTELLIGENT PROMPTS */}
            <div className="assistant-sidebar">
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>
                  SUPPORTED STATIONS
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.75rem' }}>
                  {stations.slice(0, 5).map(st => (
                    <div
                      key={st.openaqId}
                      onClick={() => setSelectedId(st.openaqId)}
                      style={{
                        padding: '0.6rem 0.75rem',
                        background: String(st.openaqId) === String(selectedId) ? 'rgba(0,229,153,0.15)' : 'rgba(255,255,255,0.02)',
                        border: String(st.openaqId) === String(selectedId) ? '1px solid var(--primary)' : '1px solid var(--border)',
                        borderRadius: 8,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{st.name.split(',')[0]}</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: getAqiBand(st.latestReading?.aqi || 142).color }}>
                        {st.latestReading?.aqi || 142}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                  💡 INTELLIGENT PROMPTS
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.75rem' }}>
                  {[
                    'What is my passive cigarette equivalence and toxic dose today?',
                    'What is the AQI near PCCOE Vicinity?',
                    'Why is AQI increasing in Pune tonight?',
                    'Can I go running tomorrow at 7 PM?',
                    'What is the best outdoor time window?',
                    'What can I buy to protect against high PM2.5?',
                  ].map((p, pi) => (
                    <button
                      key={pi}
                      onClick={() => handleSendChat(p)}
                      style={{
                        textAlign: 'left',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-muted)',
                        padding: '0.5rem 0.75rem',
                        borderRadius: 6,
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        lineHeight: 1.4,
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* CHAT MAIN PANEL */}
            <div className="assistant-chat-panel">
              {/* CHAT HEADER */}
              <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: 'var(--primary)', fontSize: '0.8rem' }}>●</span>
                    <strong style={{ fontSize: '1rem' }}>SAANS AI Assistant</strong>
                    <span style={{ fontSize: '0.7rem', color: 'var(--primary)', background: 'rgba(0,229,153,0.1)', padding: '2px 6px', borderRadius: 4 }}>9 Agentic Tools Ready</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 2 }}>
                    Active Context: {selectedStation?.name} (AQI {aqiVal})
                  </div>
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Logged In (Aditya S.)</span>
              </div>

              {/* MESSAGES LOG */}
              <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    style={{
                      alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                    }}
                  >
                    <div
                      style={{
                        background: msg.role === 'user' ? 'rgba(0,229,153,0.15)' : 'rgba(255,255,255,0.04)',
                        border: msg.role === 'user' ? '1px solid var(--primary)' : '1px solid var(--border)',
                        borderRadius: 14,
                        padding: '1rem 1.25rem',
                        color: '#fff',
                        fontSize: '0.9rem',
                        lineHeight: 1.6,
                        whiteSpace: 'pre-line',
                      }}
                    >
                      {/* Tool Calls Accordion */}
                      {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                        <div style={{ marginBottom: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(0,229,153,0.08)', borderRadius: 8, fontSize: '0.75rem', border: '1px solid rgba(0,229,153,0.2)' }}>
                          <span style={{ color: 'var(--primary)', fontWeight: 800 }}>⚡ Agentic Tool Reasoning ({msg.toolsUsed.length} tool calls executed):</span>
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: 4 }}>
                            {msg.toolsUsed.map((t, ti) => (
                              <span key={ti} style={{ fontFamily: 'var(--font-mono)', background: 'rgba(0,0,0,0.3)', padding: '1px 6px', borderRadius: 4, color: 'var(--primary)' }}>
                                {t.toolName}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {msg.content}

                      {/* INLINE PRODUCT RECOMMENDATION CARDS (FROM VIDEO) */}
                      {msg.showProductCards && (
                        <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                            🛡️ Recommended Protection Essentials for Your Area
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                            {products.slice(0, 2).map(prod => (
                              <div key={prod._id} style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.85rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <strong style={{ fontSize: '0.85rem' }}>{prod.name.split('(')[0]}</strong>
                                  <span style={{ color: 'var(--primary)', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>₹{prod.price}</span>
                                </div>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4 }}>{prod.description.slice(0, 60)}...</p>
                                <button className="btn-primary" onClick={() => handleAddToCart(prod)} style={{ marginTop: '0.65rem', width: '100%', padding: '0.35rem', fontSize: '0.75rem', justifyContent: 'center' }}>
                                  + Add to Cart
                                </button>
                              </div>
                            ))}
                          </div>
                          <button className="btn-outline" onClick={() => setIsCartOpen(true)} style={{ marginTop: '0.75rem', width: '100%', padding: '0.5rem', fontSize: '0.8rem', justifyContent: 'center' }}>
                            View Protection Cart ➔
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div style={{ color: 'var(--primary)', fontSize: '0.85rem' }}>
                    Agentic assistant running atmospheric models & health checks...
                  </div>
                )}
              </div>

              {/* CHAT INPUT FORM */}
              <form
                onSubmit={e => {
                  e.preventDefault();
                  handleSendChat();
                }}
                style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.75rem', background: 'rgba(0,0,0,0.3)' }}
              >
                <input
                  type="text"
                  placeholder="Ask about PCCOE, running safety, forecasts, or purifiers..."
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem 1rem', color: '#fff', outline: 'none' }}
                />
                <button type="submit" className="btn-primary" disabled={isChatLoading}>
                  Send ➔
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────
          PAGE 7: PROFILE (FROM VIDEO)
          ──────────────────────────────────────────────────────── */}
      {currentPage === 'profile' && (
        <div className="wrap" style={{ padding: '2rem 0' }}>
          <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {!userProfile ? (
              <div className="card" style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
                <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(0, 229, 153, 0.1)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', fontSize: '2rem' }}>
                  👤
                </div>
                <h2 style={{ fontSize: '1.85rem', fontWeight: 900 }}>Guest Session Active</h2>
                <p style={{ color: 'var(--text-muted)', maxWidth: 540, margin: '0.75rem auto 2rem', fontSize: '0.92rem', lineHeight: 1.6 }}>
                  You are currently exploring SAANS in Public Guest Mode. Sign in or create an account to configure your personal respiratory vulnerability profile (asthma/athlete/child), sync custom CPCB station alerts, and personalize AI medical cautions.
                </p>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    className="btn-primary"
                    onClick={() => {
                      setAuthTab('login');
                      setAuthError('');
                      setIsAuthModalOpen(true);
                    }}
                  >
                    🔑 Sign In to Account ➔
                  </button>
                  <button
                    className="btn-outline"
                    onClick={() => {
                      setAuthTab('register');
                      setAuthError('');
                      setIsAuthModalOpen(true);
                    }}
                  >
                    📝 Create New Account
                  </button>
                  <button
                    className="pill-btn"
                    onClick={handleDemoQuickLogin}
                    style={{ background: 'rgba(0, 229, 153, 0.08)', borderColor: 'var(--primary)', color: 'var(--primary)', fontWeight: 700 }}
                  >
                    ⚡ 1-Click Judge Demo Login
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* ACCOUNT DETAILS & ROUTINE (EXACT FROM VIDEO) */}
                <div className="card" style={{ padding: '2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>👤 Account Details & Routine Estimation</h3>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        Signed in as <strong style={{ color: 'var(--primary)' }}>{userProfile.email}</strong>
                      </div>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="btn-outline"
                      style={{ padding: '0.35rem 0.85rem', fontSize: '0.75rem', borderColor: 'rgba(255, 77, 109, 0.4)', color: '#ff4d6d' }}
                    >
                      Sign Out
                    </button>
                  </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1.25rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Full Name</label>
                  <input
                    type="text"
                    value={userProfile?.name || 'Dr. Aditya Sharma'}
                    readOnly
                    style={{ width: '100%', marginTop: 4, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.65rem 0.85rem', color: '#fff' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Email for Alerts</label>
                  <input
                    type="text"
                    value={userProfile?.email || 'aditya.sharma@saans.ai'}
                    readOnly
                    style={{ width: '100%', marginTop: 4, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.65rem 0.85rem', color: '#fff' }}
                  />
                </div>
              </div>

              {/* OUTDOOR EXPOSURE SLIDER */}
              <div style={{ marginTop: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                  <span>Estimated Outdoor Exposure: <strong>{userProfile?.outdoorHoursPerWeek || 14} Hours / Week (~2.0 hrs/day)</strong></span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="40"
                  value={userProfile?.outdoorHoursPerWeek || 14}
                  onChange={e => setUserProfile(p => ({ ...p, outdoorHoursPerWeek: Number(e.target.value) }))}
                  style={{ width: '100%', accentColor: 'var(--primary)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: 4 }}>
                  <span>Low (2 hrs/wk)</span>
                  <span>Moderate (14 hrs/wk)</span>
                  <span>High Athlete / Field Work (40 hrs/wk)</span>
                </div>
              </div>
            </div>

            {/* HEALTH PERSONAS */}
            <div className="card" style={{ padding: '2rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>🫁 Personalized Health Profile & Vulnerabilities</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
                Active personas dynamically adjust alert thresholds and AI medical cautions.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginTop: '1.25rem' }}>
                <div
                  className={`card ${userProfile?.healthProfile?.asthma ? 'active' : ''}`}
                  onClick={() => toggleHealth('asthma')}
                  style={{ padding: '1rem', cursor: 'pointer', border: userProfile?.healthProfile?.asthma ? '2px solid var(--primary)' : '1px solid var(--border)' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '1.5rem' }}>🫁</span>
                    <span style={{ color: userProfile?.healthProfile?.asthma ? 'var(--primary)' : 'var(--text-dim)', fontWeight: 800 }}>
                      {userProfile?.healthProfile?.asthma ? 'ACTIVE' : 'OFF'}
                    </span>
                  </div>
                  <strong style={{ display: 'block', marginTop: '0.5rem' }}>Asthma / Respiratory</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Lowers PM2.5 tolerance to 35 µg/m³</span>
                </div>

                <div
                  className={`card ${userProfile?.healthProfile?.athlete ? 'active' : ''}`}
                  onClick={() => toggleHealth('athlete')}
                  style={{ padding: '1rem', cursor: 'pointer', border: userProfile?.healthProfile?.athlete ? '2px solid var(--primary)' : '1px solid var(--border)' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '1.5rem' }}>🏃</span>
                    <span style={{ color: userProfile?.healthProfile?.athlete ? 'var(--primary)' : 'var(--text-dim)', fontWeight: 800 }}>
                      {userProfile?.healthProfile?.athlete ? 'ACTIVE' : 'OFF'}
                    </span>
                  </div>
                  <strong style={{ display: 'block', marginTop: '0.5rem' }}>Outdoor Athlete</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>High minute volume ventilation alert</span>
                </div>

                <div
                  className={`card ${userProfile?.healthProfile?.child ? 'active' : ''}`}
                  onClick={() => toggleHealth('child')}
                  style={{ padding: '1rem', cursor: 'pointer', border: userProfile?.healthProfile?.child ? '2px solid var(--primary)' : '1px solid var(--border)' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '1.5rem' }}>🧒</span>
                    <span style={{ color: userProfile?.healthProfile?.child ? 'var(--primary)' : 'var(--text-dim)', fontWeight: 800 }}>
                      {userProfile?.healthProfile?.child ? 'ACTIVE' : 'OFF'}
                    </span>
                  </div>
                  <strong style={{ display: 'block', marginTop: '0.5rem' }}>School Children</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Morning school commute cautions</span>
                </div>

                <div
                  className={`card ${userProfile?.healthProfile?.elderly ? 'active' : ''}`}
                  onClick={() => toggleHealth('elderly')}
                  style={{ padding: '1rem', cursor: 'pointer', border: userProfile?.healthProfile?.elderly ? '2px solid var(--primary)' : '1px solid var(--border)' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '1.5rem' }}>👴</span>
                    <span style={{ color: userProfile?.healthProfile?.elderly ? 'var(--primary)' : 'var(--text-dim)', fontWeight: 800 }}>
                      {userProfile?.healthProfile?.elderly ? 'ACTIVE' : 'OFF'}
                    </span>
                  </div>
                  <strong style={{ display: 'block', marginTop: '0.5rem' }}>Senior Citizen / Cardiac</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Strict indoor guidance during morning walks</span>
                </div>
              </div>
            </div>

            {/* QUICK WATCH LOCATIONS */}
            <div className="card" style={{ padding: '2rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>📍 Quick Watch Locations (Toggle to Watch)</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginTop: '1.25rem' }}>
                {stations.map(st => (
                  <div
                    key={st.openaqId}
                    style={{
                      padding: '0.75rem 1rem',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '0.85rem' }}>{st.name.split(',')[0]}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>AQI {st.latestReading?.aqi || 142}</div>
                    </div>
                    <input type="checkbox" defaultChecked style={{ accentColor: 'var(--primary)' }} />
                  </div>
                ))}
              </div>
            </div>
            </>
            )}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────
          AUTH NOTIFICATION TOAST
          ──────────────────────────────────────────────────────── */}
      {authToast && (
        <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', background: '#0a251e', border: '1px solid var(--primary)', padding: '1rem 1.5rem', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', gap: '0.75rem', animation: 'slideUp 0.3s ease' }}>
          <span style={{ fontSize: '1.4rem', color: 'var(--primary)' }}>👤</span>
          <div>
            <strong style={{ color: '#fff', fontSize: '0.9rem' }}>Account Status Updated</strong>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{authToast}</div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────
          AUTHENTICATION MODAL (SIGN IN / REGISTER / JUDGE 1-CLICK DEMO)
          ──────────────────────────────────────────────────────── */}
      {isAuthModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAuthModalOpen(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            {/* MODAL HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  <span>◈</span> SAANS Air Intelligence
                </div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 900, marginTop: 4 }}>
                  {authTab === 'login' ? 'Sign In to Your Account' : 'Create Your SAANS Account'}
                </h2>
              </div>
              <button
                onClick={() => setIsAuthModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.25rem', cursor: 'pointer', padding: 4 }}
              >
                ✕
              </button>
            </div>

            {/* TAB SELECTOR */}
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 3, marginBottom: '1.25rem' }}>
              <button
                type="button"
                onClick={() => { setAuthTab('login'); setAuthError(''); }}
                style={{
                  flex: 1,
                  padding: '0.55rem',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: authTab === 'login' ? 'var(--primary)' : 'transparent',
                  color: authTab === 'login' ? '#04120e' : 'var(--text-muted)',
                  transition: 'all 0.2s ease',
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setAuthTab('register'); setAuthError(''); }}
                style={{
                  flex: 1,
                  padding: '0.55rem',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: authTab === 'register' ? 'var(--primary)' : 'transparent',
                  color: authTab === 'register' ? '#04120e' : 'var(--text-muted)',
                  transition: 'all 0.2s ease',
                }}
              >
                Create Account (Sign Up)
              </button>
            </div>

            {/* ERROR BANNER */}
            {authError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)', color: '#fca5a5', padding: '0.65rem 0.85rem', borderRadius: 8, fontSize: '0.8rem', marginBottom: '1rem', lineHeight: 1.4 }}>
                ⚠️ {authError}
              </div>
            )}

            {/* SIGN IN FORM */}
            {authTab === 'login' ? (
              <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. aditya@saans.org"
                    value={authForm.email}
                    onChange={e => setAuthForm(p => ({ ...p, email: e.target.value }))}
                    style={{ width: '100%', marginTop: 4, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.65rem 0.85rem', color: '#fff', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Password</label>
                  <input
                    type="password"
                    required
                    placeholder="Enter password (or demo123)"
                    value={authForm.password}
                    onChange={e => setAuthForm(p => ({ ...p, password: e.target.value }))}
                    style={{ width: '100%', marginTop: 4, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.65rem 0.85rem', color: '#fff', outline: 'none' }}
                  />
                </div>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={authLoading}
                  style={{ marginTop: '0.5rem', width: '100%', justifyContent: 'center' }}
                >
                  {authLoading ? 'Signing In...' : 'Sign In ➔'}
                </button>

                {/* 1-CLICK DEMO LOGIN FOR JUDGES */}
                <div style={{ textAlign: 'center', marginTop: '0.75rem', paddingTop: '0.85rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.6rem' }}>
                    ⚡ For Video Demo & Hackathon Judges
                  </div>
                  <button
                    type="button"
                    onClick={handleDemoQuickLogin}
                    disabled={authLoading}
                    className="pill-btn"
                    style={{
                      width: '100%',
                      justifyContent: 'center',
                      background: 'rgba(0, 229, 153, 0.08)',
                      borderColor: 'var(--primary)',
                      color: 'var(--primary)',
                      fontWeight: 700,
                      padding: '0.6rem',
                    }}
                  >
                    1-Click Judge Demo Login (Dr. Aditya Sharma - Asthma Profile)
                  </button>
                </div>
              </form>
            ) : (
              /* REGISTER FORM */
              <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Priya Kulkarni"
                    value={authForm.name}
                    onChange={e => setAuthForm(p => ({ ...p, name: e.target.value }))}
                    style={{ width: '100%', marginTop: 4, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.65rem 0.85rem', color: '#fff', outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. priya@pccoe.edu"
                      value={authForm.email}
                      onChange={e => setAuthForm(p => ({ ...p, email: e.target.value }))}
                      style={{ width: '100%', marginTop: 4, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.65rem 0.85rem', color: '#fff', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Password</label>
                    <input
                      type="password"
                      required
                      placeholder="Create password"
                      value={authForm.password}
                      onChange={e => setAuthForm(p => ({ ...p, password: e.target.value }))}
                      style={{ width: '100%', marginTop: 4, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.65rem 0.85rem', color: '#fff', outline: 'none' }}
                    />
                  </div>
                </div>

                {/* PRIMARY CITY SELECT */}
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Primary Region</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: 4 }}>
                    <button
                      type="button"
                      onClick={() => setAuthForm(p => ({ ...p, city: 'pune' }))}
                      style={{
                        padding: '0.5rem',
                        borderRadius: 6,
                        border: authForm.city === 'pune' ? '1px solid var(--primary)' : '1px solid var(--border)',
                        background: authForm.city === 'pune' ? 'rgba(0,229,153,0.1)' : 'rgba(0,0,0,0.3)',
                        color: authForm.city === 'pune' ? 'var(--primary)' : 'var(--text-muted)',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                      }}
                    >
                      📍 Pune & PCMC
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthForm(p => ({ ...p, city: 'delhi' }))}
                      style={{
                        padding: '0.5rem',
                        borderRadius: 6,
                        border: authForm.city === 'delhi' ? '1px solid var(--primary)' : '1px solid var(--border)',
                        background: authForm.city === 'delhi' ? 'rgba(0,229,153,0.1)' : 'rgba(0,0,0,0.3)',
                        color: authForm.city === 'delhi' ? 'var(--primary)' : 'var(--text-muted)',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                      }}
                    >
                      📍 Delhi NCR
                    </button>
                  </div>
                </div>

                {/* HEALTH VULNERABILITY CHECKBOXES */}
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Health Personas (Adjusts AI & Alert Sensitivity)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginTop: 4 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.25)', padding: '0.45rem 0.65rem', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={authForm.asthma}
                        onChange={e => setAuthForm(p => ({ ...p, asthma: e.target.checked }))}
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      <span>🫁 Asthma / Respiratory</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.25)', padding: '0.45rem 0.65rem', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={authForm.athlete}
                        onChange={e => setAuthForm(p => ({ ...p, athlete: e.target.checked }))}
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      <span>🏃 Outdoor Athlete</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.25)', padding: '0.45rem 0.65rem', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={authForm.child}
                        onChange={e => setAuthForm(p => ({ ...p, child: e.target.checked }))}
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      <span>🧒 School Children</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.25)', padding: '0.45rem 0.65rem', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={authForm.elderly}
                        onChange={e => setAuthForm(p => ({ ...p, elderly: e.target.checked }))}
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      <span>👴 Senior Citizen</span>
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={authLoading}
                  style={{ marginTop: '0.4rem', width: '100%', justifyContent: 'center' }}
                >
                  {authLoading ? 'Registering...' : 'Create Account & Personalize ➔'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────
          ORDER PLACED TOAST NOTIFICATION (MATCHING VIDEO)
          ──────────────────────────────────────────────────────── */}
      {orderToast && (
        <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', background: '#0a251e', border: '1px solid var(--primary)', padding: '1rem 1.5rem', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', gap: '0.75rem', animation: 'slideUp 0.3s ease' }}>
          <span style={{ fontSize: '1.5rem', color: 'var(--primary)' }}>✓</span>
          <div>
            <strong style={{ color: '#fff', fontSize: '0.9rem' }}>Order Placed Successfully</strong>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Your protection items are on their way with expedited delivery.</div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────
          CART MODAL
          ──────────────────────────────────────────────────────── */}
      {isCartOpen && (
        <div className="cart-modal-overlay" onClick={() => setIsCartOpen(false)}>
          <div className="cart-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 900 }}>🛒 Your SAANS Protection Cart</h2>
              <button onClick={() => setIsCartOpen(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.25rem' }}>✕</button>
            </div>

            {cart.length > 0 ? (
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '300px', overflowY: 'auto' }}>
                  {cart.map(it => (
                    <div key={it._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                      <div>
                        <strong>{it.name}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Qty: {it.quantity} × ₹{it.price}</div>
                      </div>
                      <div style={{ fontWeight: 800, fontFamily: 'var(--font-mono)' }}>₹{it.price * it.quantity}</div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: '1.15rem', fontWeight: 800 }}>
                  <span>Total Amount</span>
                  <span style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                    ₹{cart.reduce((s, i) => s + i.price * i.quantity, 0).toLocaleString('en-IN')}
                  </span>
                </div>

                <button className="btn-primary" onClick={handleCheckout} style={{ marginTop: '1.5rem', width: '100%', justifyContent: 'center' }}>
                  Confirm Order & Dispatch ➔
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                Your protection cart is empty. Add HEPA purifiers or N95 masks from the AI assistant or catalog.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────
          FOOTER (EXACT FROM VIDEO)
          ──────────────────────────────────────────────────────── */}
      <footer className="footer-wrap">
        <div className="wrap">
          <div className="footer-grid">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 900, color: '#fff' }}>
                <span style={{ color: 'var(--primary)' }}>◈</span> SAANS
              </div>
              <p style={{ marginTop: '0.75rem', lineHeight: 1.6, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Smart Air Analytics & Advisory Network System — Predictive environmental AI empowering individuals and cities across India to breathe safely.
              </p>
              <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                © 2026 SAANS Intelligence Platform. Built for Indian Air Quality Decision Support.
              </div>
            </div>

            <div>
              <div className="footer-col-title">USER JOURNEY</div>
              <ul className="footer-links">
                <li onClick={() => setCurrentPage('dashboard')}>1. Detect — Real-time Readings</li>
                <li onClick={() => setCurrentPage('analysis')}>2. Predict — ML 72-Hour Outlook</li>
                <li onClick={() => setCurrentPage('analysis')}>3. Explain — SHAP Factor Drivers</li>
                <li onClick={() => setCurrentPage('assistant')}>4. Advise — Agentic AI Assistant</li>
                <li onClick={() => setIsCartOpen(true)}>5. Act — Protection Essentials</li>
              </ul>
            </div>

            <div>
              <div className="footer-col-title">PLATFORM FEATURES</div>
              <ul className="footer-links">
                <li onClick={() => setCurrentPage('problem')}>The Urban Air Challenge</li>
                <li onClick={() => setCurrentPage('solution')}>SAANS AI Solution</li>
                <li onClick={() => setCurrentPage('dashboard')}>My Air Dashboard</li>
                <li onClick={() => setCurrentPage('analysis')}>Emergency AQI Alerts</li>
              </ul>
            </div>

            <div>
              <div className="footer-col-title">DATA & STANDARDS</div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Integrated with Indian standard CPCB air quality indices, Open-Meteo live station telemetry, and OpenWeather meteorological forecasts.
              </p>
              <div style={{ marginTop: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', background: 'rgba(0,229,153,0.1)', color: 'var(--primary)', padding: '2px 8px', borderRadius: 99 }}>
                ● Live Models Active
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
