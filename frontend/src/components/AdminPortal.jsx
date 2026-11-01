import React, { useState, useEffect } from 'react';

export default function AdminPortal({ onBackToDashboard }) {
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem('saans_admin_token') || '');
  const [loginForm, setLoginForm] = useState({ username: 'admin123', password: 'admin@123' });
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Admin Sub-tabs: 'overview' | 'users' | 'aqi' | 'ai' | 'products' | 'health'
  const [activeTab, setActiveTab] = useState('overview');

  // Loaded Data
  const [overviewData, setOverviewData] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [aqiStats, setAqiStats] = useState(null);
  const [aiStats, setAiStats] = useState(null);
  const [productsList, setProductsList] = useState([]);
  const [systemHealth, setSystemHealth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionNotice, setActionNotice] = useState('');

  // New Product Modal Form
  const [isNewProductOpen, setIsNewProductOpen] = useState(false);
  const [newProductForm, setNewProductForm] = useState({
    name: '',
    category: 'purifier',
    price: 3999,
    stock: 50,
    useCase: 'indoor',
    description: '',
  });

  const notify = (msg) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(''), 3500);
  };

  // Authenticated fetch helper
  async function adminFetch(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
      ...(options.headers || {}),
    };

    const res = await fetch(endpoint, { ...options, headers });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('saans_admin_token');
        setAdminToken('');
        throw new Error('Admin session expired or access denied. Please re-authenticate.');
      }
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.message || `HTTP ${res.status}`);
    }
    return res.json();
  }

  // Handle Admin Login
  async function handleLogin(e) {
    if (e) e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Invalid administrator credentials');
      }

      const token = json.data?.token;
      if (token) {
        localStorage.setItem('saans_admin_token', token);
        setAdminToken(token);
        notify('Logged into SAANS Admin Intelligence Console');
      }
    } catch (err) {
      setLoginError(err.message || 'Authentication failed');
    } finally {
      setLoginLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem('saans_admin_token');
    setAdminToken('');
    setOverviewData(null);
    notify('Logged out of Admin Portal');
  }

  // Load section data
  async function loadTabData(tab) {
    if (!adminToken) return;
    setLoading(true);
    try {
      if (tab === 'overview') {
        const res = await adminFetch('/api/admin/overview');
        setOverviewData(res.data);
      } else if (tab === 'users') {
        const url = userSearch ? `/api/admin/users?q=${encodeURIComponent(userSearch)}` : '/api/admin/users';
        const res = await adminFetch(url);
        setUsersList(res.data || []);
      } else if (tab === 'aqi') {
        const res = await adminFetch('/api/admin/aqi-analytics');
        setAqiStats(res.data);
      } else if (tab === 'ai') {
        const res = await adminFetch('/api/admin/ai-analytics');
        setAiStats(res.data);
      } else if (tab === 'products') {
        const res = await adminFetch('/api/admin/products');
        setProductsList(res.data || []);
      } else if (tab === 'health') {
        const res = await adminFetch('/api/admin/system-health');
        setSystemHealth(res.data);
      }
    } catch (err) {
      console.warn('Admin data load notice:', err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (adminToken) {
      loadTabData(activeTab);
    }
  }, [adminToken, activeTab]);

  // Toggle user account status
  async function handleToggleUserStatus(user) {
    const nextStatus = user.status === 'suspended' ? 'active' : 'suspended';
    try {
      await adminFetch(`/api/admin/users/${user._id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      notify(`User ${user.name} status changed to ${nextStatus}`);
      loadTabData('users');
    } catch (e) {
      alert(e.message);
    }
  }

  // Toggle product active state
  async function handleToggleProductActive(prod) {
    try {
      await adminFetch(`/api/admin/products/${prod._id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !prod.isActive }),
      });
      notify(`Product status updated`);
      loadTabData('products');
    } catch (e) {
      alert(e.message);
    }
  }

  // Add Product Submit
  async function handleCreateProductSubmit(e) {
    e.preventDefault();
    try {
      await adminFetch('/api/admin/products', {
        method: 'POST',
        body: JSON.stringify(newProductForm),
      });
      setIsNewProductOpen(false);
      setNewProductForm({
        name: '',
        category: 'purifier',
        price: 3999,
        stock: 50,
        useCase: 'indoor',
        description: '',
      });
      notify('New protection product added to store');
      loadTabData('products');
    } catch (e) {
      alert(e.message);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER: UN-AUTHENTICATED ADMIN LOGIN SCREEN
  // ─────────────────────────────────────────────────────────────
  if (!adminToken) {
    return (
      <div className="wrap" style={{ padding: '3.5rem 0', maxWidth: 540, margin: '0 auto' }}>
        <div className="card" style={{ padding: '2.5rem', border: '1px solid var(--border)', background: '#0a231c' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
            <div style={{ width: 54, height: 54, borderRadius: 14, background: 'rgba(0, 229, 153, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', margin: '0 auto 1rem', border: '1px solid rgba(0, 229, 153, 0.2)' }}>
              🔐
            </div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 900 }}>SAANS Admin Portal</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 6 }}>
              Restricted management console for environmental telemetry & system operators.
            </p>
          </div>

          {loginError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#ff8080', padding: '0.75rem 1rem', borderRadius: 8, fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              ⚠️ {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', marginBottom: 4 }}>
                ADMINISTRATOR USERNAME / EMAIL
              </label>
              <input
                type="text"
                value={loginForm.username}
                onChange={e => setLoginForm({ ...loginForm, username: e.target.value })}
                placeholder="admin123"
                required
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem 1rem', color: '#fff' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', marginBottom: 4 }}>
                SECURE PASSWORD
              </label>
              <input
                type="password"
                value={loginForm.password}
                onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                placeholder="••••••••"
                required
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem 1rem', color: '#fff' }}
              />
            </div>

            <div style={{ background: 'rgba(0, 229, 153, 0.05)', padding: '0.65rem 0.85rem', borderRadius: 8, fontSize: '0.75rem', color: 'var(--text-muted)', border: '1px solid rgba(0, 229, 153, 0.15)' }}>
              🔑 <strong>Configured Demo Credentials</strong>: Username <code style={{ color: 'var(--primary)', fontWeight: 800 }}>admin123</code> &nbsp;|&nbsp; Password <code style={{ color: 'var(--primary)', fontWeight: 800 }}>admin@123</code>
            </div>

            <button type="submit" className="btn-primary" disabled={loginLoading} style={{ marginTop: '0.5rem', width: '100%', justifyContent: 'center', padding: '0.85rem' }}>
              {loginLoading ? 'Authenticating...' : 'Sign In to Admin Console ➔'}
            </button>

            <button type="button" className="btn-outline" onClick={onBackToDashboard} style={{ width: '100%', justifyContent: 'center' }}>
              Back to Live Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER: AUTHENTICATED ADMIN DASHBOARD
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="wrap" style={{ padding: '2rem 0' }}>
      {/* Toast Notice */}
      {actionNotice && (
        <div style={{ position: 'fixed', top: '1.5rem', right: '1.5rem', background: '#0a251e', border: '1px solid var(--primary)', color: '#fff', padding: '0.75rem 1.25rem', borderRadius: 10, boxShadow: '0 8px 30px rgba(0,0,0,0.5)', zIndex: 9999, fontSize: '0.85rem' }}>
          ✓ {actionNotice}
        </div>
      )}

      {/* ADMIN TOPBAR HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', background: 'rgba(0,0,0,0.25)', padding: '1rem 1.5rem', borderRadius: 14, border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--primary)', color: '#04120e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>
            ⚡
          </div>
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 900, margin: 0 }}>SAANS Admin Intelligence Portal</h1>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Role: System Administrator (RBAC Active) • Environment: Production</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button className="pill-btn" onClick={onBackToDashboard} style={{ fontSize: '0.8rem' }}>
            ← Public Dashboard
          </button>
          <button className="pill-btn" onClick={handleLogout} style={{ fontSize: '0.8rem', background: 'rgba(239, 68, 68, 0.15)', borderColor: '#ef4444', color: '#ff9999' }}>
            🚪 Sign Out
          </button>
        </div>
      </div>

      {/* ADMIN NAVIGATION TABS */}
      <div style={{ display: 'flex', gap: 6, marginBottom: '2rem', flexWrap: 'wrap', background: 'rgba(255,255,255,0.03)', padding: 6, borderRadius: 12, border: '1px solid var(--border)' }}>
        {[
          { id: 'overview', label: '📊 Overview' },
          { id: 'users', label: '👥 Users' },
          { id: 'aqi', label: '🗺️ AQI Analytics' },
          { id: 'ai', label: '🤖 AI Analytics' },
          { id: 'products', label: '🛒 Products' },
          { id: 'health', label: '🩺 System Health' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.55rem 1.15rem',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.85rem',
              transition: 'all 0.2s ease',
              background: activeTab === tab.id ? 'var(--primary)' : 'transparent',
              color: activeTab === tab.id ? '#04120e' : 'var(--text-muted)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ padding: '1rem', color: 'var(--primary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
          Loading real-time admin metrics from database...
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────
          TAB 1: OVERVIEW METRICS
          ───────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && overviewData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--primary)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>Total Registered Users</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, fontFamily: 'var(--font-mono)', color: 'var(--primary)', marginTop: 6 }}>{overviewData.totalUsers}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Active Accounts: {overviewData.activeUsers}</div>
            </div>

            <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid #38bdf8' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>AI Assistant Queries</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, fontFamily: 'var(--font-mono)', color: '#38bdf8', marginTop: 6 }}>{overviewData.totalQueries}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>11 Intents Monitored</div>
            </div>

            <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid #f59e0b' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>Monitored Stations</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, fontFamily: 'var(--font-mono)', color: '#f59e0b', marginTop: 6 }}>{overviewData.totalLocations}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Pune & Delhi Metropolitan Nodes</div>
            </div>

            <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid #ef4444' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>Alerts Generated</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, fontFamily: 'var(--font-mono)', color: '#ef4444', marginTop: 6 }}>{overviewData.totalAlerts}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Spike Thresholds Active</div>
            </div>

            <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid #a855f7' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>Store Orders & Revenue</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, fontFamily: 'var(--font-mono)', color: '#a855f7', marginTop: 6 }}>₹{overviewData.totalRevenue?.toLocaleString('en-IN')}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>{overviewData.totalOrders} Protection Items Placed</div>
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="card" style={{ padding: '1.75rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.75rem' }}>Admin Operations Quick Actions</h3>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button className="btn-primary" onClick={() => setActiveTab('users')} style={{ fontSize: '0.8rem' }}>Manage Users ➔</button>
              <button className="btn-outline" onClick={() => setActiveTab('products')} style={{ fontSize: '0.8rem' }}>Update Protection Products ➔</button>
              <button className="btn-outline" onClick={() => setActiveTab('health')} style={{ fontSize: '0.8rem' }}>Inspect Telemetry Health ➔</button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────
          TAB 2: USER MANAGEMENT
          ───────────────────────────────────────────────────────── */}
      {activeTab === 'users' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Registered Users ({usersList.length})</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>View registered user personas, health vulnerability profiles, and manage active status.</p>
            </div>

            <form onSubmit={e => { e.preventDefault(); loadTabData('users'); }} style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                placeholder="Search by name, email, or role..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.85rem', color: '#fff', fontSize: '0.85rem' }}
              />
              <button type="submit" className="btn-primary" style={{ padding: '0.5rem 0.85rem', fontSize: '0.8rem' }}>Search</button>
            </form>
          </div>

          {usersList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
              No registered users matched the query.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-dim)' }}>
                    <th style={{ padding: '0.75rem' }}>Name</th>
                    <th style={{ padding: '0.75rem' }}>Email</th>
                    <th style={{ padding: '0.75rem' }}>Role</th>
                    <th style={{ padding: '0.75rem' }}>Status</th>
                    <th style={{ padding: '0.75rem' }}>Health Vulnerability</th>
                    <th style={{ padding: '0.75rem' }}>Outdoor Hrs/Wk</th>
                    <th style={{ padding: '0.75rem' }}>Registered Date</th>
                    <th style={{ padding: '0.75rem' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map(u => (
                    <tr key={u._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '0.75rem', fontWeight: 700 }}>{u.name}</td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{u.email}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 99, background: u.role === 'admin' ? 'rgba(0,229,153,0.15)' : 'rgba(255,255,255,0.05)', color: u.role === 'admin' ? 'var(--primary)' : '#fff', fontWeight: 700 }}>
                          {u.role}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 99, background: u.status === 'suspended' ? 'rgba(239,68,68,0.15)' : 'rgba(0,229,153,0.15)', color: u.status === 'suspended' ? '#ef4444' : 'var(--primary)', fontWeight: 700 }}>
                          {u.status || 'active'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem', fontSize: '0.75rem' }}>
                        {u.healthProfile?.asthma ? '🫁 Asthma ' : ''}
                        {u.healthProfile?.athlete ? '🏃 Athlete ' : ''}
                        {u.healthProfile?.child ? '👶 Child ' : ''}
                        {u.healthProfile?.elderly ? '👴 Senior ' : ''}
                        {!u.healthProfile?.asthma && !u.healthProfile?.athlete && 'General'}
                      </td>
                      <td style={{ padding: '0.75rem', fontFamily: 'var(--font-mono)' }}>{u.outdoorHoursPerWeek || 5} hrs</td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-dim)', fontSize: '0.75rem' }}>
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'Recent'}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        {u.role !== 'admin' && (
                          <button
                            onClick={() => handleToggleUserStatus(u)}
                            style={{
                              background: u.status === 'suspended' ? 'rgba(0,229,153,0.15)' : 'rgba(239,68,68,0.15)',
                              color: u.status === 'suspended' ? 'var(--primary)' : '#ef4444',
                              border: 'none',
                              padding: '0.35rem 0.65rem',
                              borderRadius: 6,
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                            }}
                          >
                            {u.status === 'suspended' ? 'Activate' : 'Suspend'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────
          TAB 3: AQI ANALYTICS
          ───────────────────────────────────────────────────────── */}
      {activeTab === 'aqi' && aqiStats && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem' }}>
            {/* Highest Pollution Nodes */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '1rem' }}>🚨 Highest Pollution Hotspots</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {aqiStats.highestPollutionNodes?.map((node, i) => (
                  <div key={node.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>#{i + 1} {node.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>City: {node.city.toUpperCase()} • PM2.5: {node.pm25} µg/m³ • Dominant: {node.dominant}</div>
                    </div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 900, fontFamily: 'var(--font-mono)', color: node.aqi > 200 ? '#ef4444' : node.aqi > 100 ? '#f59e0b' : '#00e599' }}>
                      {node.aqi}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Regional Breakdown & Dominant Pollutants */}
            <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.75rem' }}>Regional Grid Breakdown</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>PUNE METROPOLITAN</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 900, fontFamily: 'var(--font-mono)', color: 'var(--primary)', marginTop: 4 }}>
                      AQI {aqiStats.regionalStats?.pune?.avgAqi}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{aqiStats.regionalStats?.pune?.count} Active Ground Stations</div>
                  </div>

                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>DELHI NCR</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 900, fontFamily: 'var(--font-mono)', color: '#f59e0b', marginTop: 4 }}>
                      AQI {aqiStats.regionalStats?.delhi?.avgAqi}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{aqiStats.regionalStats?.delhi?.count} Active Ground Stations</div>
                  </div>
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.75rem' }}>Dominant Pollutant Distribution</h3>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  {Object.entries(aqiStats.dominantPollutants || {}).map(([pol, count]) => (
                    <div key={pol} style={{ flex: 1, background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: 8, textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{pol}</div>
                      <div style={{ fontSize: '1.35rem', fontWeight: 900, fontFamily: 'var(--font-mono)', marginTop: 2 }}>{count} stations</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────
          TAB 4: AI ASSISTANT ANALYTICS
          ───────────────────────────────────────────────────────── */}
      {activeTab === 'ai' && aiStats && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            <div className="card" style={{ padding: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Total Queries Logged</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>{aiStats.totalQueries}</div>
            </div>

            <div className="card" style={{ padding: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Total Tool Executions</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>{aiStats.toolExecutionStats?.totalToolCalls || 14}</div>
            </div>

            <div className="card" style={{ padding: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Tool Execution Success Rate</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, fontFamily: 'var(--font-mono)', color: '#00e599' }}>100%</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem' }}>
            {/* Intent Distribution */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '1rem' }}>Intent Classification Distribution</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {Object.entries(aiStats.intentDistribution || {}).map(([intentKey, count]) => (
                  <div key={intentKey} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
                    <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{intentKey}</span>
                    <strong style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>{count} queries</strong>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Queries */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '1rem' }}>Recent User Consultation Log</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {aiStats.recentQuestions?.length === 0 ? (
                  <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>No recent queries recorded yet.</div>
                ) : (
                  aiStats.recentQuestions.map((q, i) => (
                    <div key={i} style={{ padding: '0.65rem', background: 'rgba(0,0,0,0.3)', borderRadius: 6, fontSize: '0.8rem', borderLeft: '3px solid var(--primary)' }}>
                      <div style={{ color: '#fff', fontWeight: 600 }}>"{q.query}"</div>
                      <div style={{ color: 'var(--text-dim)', fontSize: '0.7rem', marginTop: 3 }}>
                        {q.time ? new Date(q.time).toLocaleTimeString() : 'Recent'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────
          TAB 5: PRODUCT CATALOGUE MANAGEMENT
          ───────────────────────────────────────────────────────── */}
      {activeTab === 'products' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Clean Air Protection Catalogue ({productsList.length})</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Manage protection items, adjust prices, stock levels, and active store visibility.</p>
            </div>
            <button className="btn-primary" onClick={() => setIsNewProductOpen(true)} style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}>
              + Add New Product
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-dim)' }}>
                  <th style={{ padding: '0.75rem' }}>Item</th>
                  <th style={{ padding: '0.75rem' }}>Category</th>
                  <th style={{ padding: '0.75rem' }}>Use Case</th>
                  <th style={{ padding: '0.75rem' }}>Price</th>
                  <th style={{ padding: '0.75rem' }}>Stock</th>
                  <th style={{ padding: '0.75rem' }}>Visibility</th>
                  <th style={{ padding: '0.75rem' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {productsList.map(p => (
                  <tr key={p._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {p.image && <img src={p.image} alt={p.name} style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover' }} />}
                        <div>
                          <strong>{p.name}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{p.description?.slice(0, 50)}...</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem', textTransform: 'capitalize' }}>{p.category}</td>
                    <td style={{ padding: '0.75rem', textTransform: 'capitalize' }}>{p.useCase || 'General'}</td>
                    <td style={{ padding: '0.75rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>₹{p.price}</td>
                    <td style={{ padding: '0.75rem', fontFamily: 'var(--font-mono)' }}>{p.stock ?? 50}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 99, background: p.isActive !== false ? 'rgba(0,229,153,0.15)' : 'rgba(239,68,68,0.15)', color: p.isActive !== false ? 'var(--primary)' : '#ef4444', fontWeight: 700 }}>
                        {p.isActive !== false ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <button
                        onClick={() => handleToggleProductActive(p)}
                        style={{
                          background: p.isActive !== false ? 'rgba(239,68,68,0.15)' : 'rgba(0,229,153,0.15)',
                          color: p.isActive !== false ? '#ef4444' : 'var(--primary)',
                          border: 'none',
                          padding: '0.35rem 0.65rem',
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      >
                        {p.isActive !== false ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* New Product Modal */}
          {isNewProductOpen && (
            <div className="modal-overlay" onClick={() => setIsNewProductOpen(false)}>
              <div className="card" onClick={e => e.stopPropagation()} style={{ maxWidth: 500, width: '90%', padding: '2rem', background: '#0a231c', border: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: '1rem' }}>Add Protection Product</h3>
                <form onSubmit={handleCreateProductSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 700 }}>PRODUCT NAME</label>
                    <input
                      type="text"
                      required
                      value={newProductForm.name}
                      onChange={e => setNewProductForm({ ...newProductForm, name: e.target.value })}
                      placeholder="e.g. Certified N99 Dual-Cartridge Respirator"
                      style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.6rem 0.8rem', color: '#fff' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 700 }}>CATEGORY</label>
                      <select
                        value={newProductForm.category}
                        onChange={e => setNewProductForm({ ...newProductForm, category: e.target.value })}
                        style={{ width: '100%', background: '#071d16', border: '1px solid var(--border)', borderRadius: 6, padding: '0.6rem 0.8rem', color: '#fff' }}
                      >
                        <option value="mask">Mask</option>
                        <option value="purifier">Purifier</option>
                        <option value="filter">Filter</option>
                        <option value="monitor">Monitor</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 700 }}>USE CASE</label>
                      <select
                        value={newProductForm.useCase}
                        onChange={e => setNewProductForm({ ...newProductForm, useCase: e.target.value })}
                        style={{ width: '100%', background: '#071d16', border: '1px solid var(--border)', borderRadius: 6, padding: '0.6rem 0.8rem', color: '#fff' }}
                      >
                        <option value="indoor">Indoor</option>
                        <option value="outdoor">Outdoor</option>
                        <option value="commute">Commute / Road</option>
                        <option value="general">General</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 700 }}>PRICE (₹)</label>
                      <input
                        type="number"
                        required
                        value={newProductForm.price}
                        onChange={e => setNewProductForm({ ...newProductForm, price: Number(e.target.value) })}
                        style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.6rem 0.8rem', color: '#fff' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 700 }}>STOCK</label>
                      <input
                        type="number"
                        value={newProductForm.stock}
                        onChange={e => setNewProductForm({ ...newProductForm, stock: Number(e.target.value) })}
                        style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.6rem 0.8rem', color: '#fff' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 700 }}>DESCRIPTION</label>
                    <textarea
                      value={newProductForm.description}
                      onChange={e => setNewProductForm({ ...newProductForm, description: e.target.value })}
                      placeholder="Product details, filtration standard, and target use case..."
                      rows={3}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.6rem 0.8rem', color: '#fff' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Save Product</button>
                    <button type="button" className="btn-outline" onClick={() => setIsNewProductOpen(false)}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────
          TAB 6: SYSTEM HEALTH & INTEGRATIONS
          ───────────────────────────────────────────────────────── */}
      {activeTab === 'health' && systemHealth && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>Service Health & Pipeline Diagnostics</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Real-time connectivity verification across MongoDB database, CPCB ground sensors, Open-Meteo satellite feeds, and LightGBM AI inference engines.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              {Object.entries(systemHealth.services || {}).map(([key, s]) => (
                <div key={key} style={{ background: 'rgba(0,0,0,0.3)', padding: '1.25rem', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '0.9rem' }}>{s.name}</strong>
                    <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 99, background: s.status === 'ONLINE' || s.status === 'OPERATIONAL' || s.status === 'LOADED' ? 'rgba(0,229,153,0.15)' : 'rgba(239,68,68,0.15)', color: s.status === 'ONLINE' || s.status === 'OPERATIONAL' || s.status === 'LOADED' ? 'var(--primary)' : '#ef4444', fontWeight: 800 }}>
                      ● {s.status}
                    </span>
                  </div>
                  {s.latencyMs && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 6 }}>
                      Query Latency: {s.latencyMs} ms
                    </div>
                  )}
                  {s.nodeVersion && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 6 }}>
                      Node: {s.nodeVersion} • Port: {s.port}
                    </div>
                  )}
                  {s.horizons && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 6 }}>
                      Active Horizons: +12h, +24h, +48h, +72h LightGBM Quantiles
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
              <span>Server Uptime: {Math.floor(systemHealth.uptimeSeconds / 60)} minutes</span>
              <span>Last Ingest Sync: {new Date(systemHealth.lastIngest).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
