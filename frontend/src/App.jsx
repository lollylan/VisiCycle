import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon in React-Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Detect backend URL dynamically:
// In production (portable exe): frontend served from backend on same port
// In dev: Vite runs on 5173, backend on 8555
const API_base = window.location.port === '5173'
  ? `http://${window.location.hostname}:8555`
  : `http://${window.location.hostname}:${window.location.port}`;

// Default Fallback
const DEFAULT_COORDS = [49.79245, 9.93296];

// Helper: display name
function displayName(p) {
  return `${p.nachname}, ${p.vorname}`;
}

// Color-coded marker icons
function createColoredIcon(color) {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="
      background:${color};
      width:14px;height:14px;
      border-radius:50%;
      border:3px solid white;
      box-shadow:0 2px 6px rgba(0,0,0,0.35);
    "></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -12]
  });
}

const praxisIcon = createColoredIcon('#dc2626');

function RecenterMap({ coords }) {
  const map = useMap();
  useEffect(() => {
    map.setView(coords, map.getZoom());
  }, [coords]);
  return null;
}


// ─── LOGIN SCREEN ────────────────────────────────────────

function LoginScreen({ onLoggedIn }) {
  const [isSetup, setIsSetup] = useState(null); // null = loading
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API_base}/auth/status`)
      .then(r => r.json())
      .then(data => {
        if (data.is_unlocked) {
          onLoggedIn();
          return;
        }
        setIsSetup(data.is_setup);
      })
      .catch(() => setError('Server nicht erreichbar. Ist das Backend gestartet?'));
  }, []);

  const handleSetup = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== passwordConfirm) {
      setError('Passwörter stimmen nicht überein.');
      return;
    }
    if (password.length < 4) {
      setError('Passwort muss mindestens 4 Zeichen lang sein.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_base}/auth/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, password_confirm: passwordConfirm }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || 'Fehler beim Einrichten.');
        return;
      }
      onLoggedIn();
    } catch {
      setError('Verbindung fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_base}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || 'Falsches Passwort.');
        return;
      }
      onLoggedIn();
    } catch {
      setError('Verbindung fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  };

  if (isSetup === null) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-logo">🔄</div>
          <p style={{ color: 'var(--color-text-muted)' }}>Verbinde mit Server...</p>
          {error && <p className="login-error">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">🚴‍♂️🏥</div>
        <h1 style={{ color: 'var(--color-primary)', fontSize: '1.75rem', marginBottom: '0.25rem' }}>VisiCycle</h1>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
          {isSetup ? 'Bitte Passwort eingeben zum Entschlüsseln' : 'Erstmaliges Einrichten – Passwort festlegen'}
        </p>

        {error && <p className="login-error">{error}</p>}

        <form onSubmit={isSetup ? handleLogin : handleSetup} style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
              {isSetup ? 'Passwort' : 'Neues Passwort'}
            </label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoFocus
              required
            />
          </div>

          {!isSetup && (
            <div>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                Passwort wiederholen
              </label>
              <input
                type="password"
                className="input"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
          )}

          <button className="btn" disabled={loading} style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}>
            {loading ? '⏳ Bitte warten...' : (isSetup ? '🔓 Entschlüsseln & Einloggen' : '🔐 Passwort festlegen & Starten')}
          </button>
        </form>

        {!isSetup ? (
          <div style={{
            marginTop: '1.5rem',
            padding: '0.75rem 1rem',
            background: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: '0.5rem',
            textAlign: 'left',
          }}>
            <p style={{ color: '#92400e', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
              ⚠️ Wichtiger Hinweis:
            </p>
            <p style={{ color: '#92400e', fontSize: '0.75rem', margin: 0 }}>
              Merken Sie sich dieses Passwort gut! Es wird zur Verschlüsselung aller Patientendaten verwendet.
              Bei Verlust des Passworts können die Daten <b>nicht wiederhergestellt</b> werden.
            </p>
          </div>
        ) : (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginTop: '1.5rem' }}>
            🔒 Alle Patientendaten werden verschlüsselt gespeichert.
          </p>
        )}
      </div>
    </div>
  );
}


// ─── MAIN APP ────────────────────────────────────────────

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [patients, setPatients] = useState([]);
  const [todaysPlan, setTodaysPlan] = useState({ patients: [], routes_by_behandler: [], stats: { total_travel_time_minutes: 0, patient_count: 0 } });
  const [behandlerList, setBehandlerList] = useState([]);
  const [view, setView] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [dailyTimeOverrides, setDailyTimeOverrides] = useState({});
  const [praxisCoords, setPraxisCoords] = useState(DEFAULT_COORDS);
  const [praxisAddress, setPraxisAddress] = useState("Praxis");
  const [editingPatient, setEditingPatient] = useState(null);

  // ─── Radius & Transport Mode State ───────────────────
  const [radiusFuss, setRadiusFuss] = useState(1);
  const [radiusRad, setRadiusRad] = useState(3);
  const [transportModes, setTransportModes] = useState({});

  // ─── Sort & Filter State ─────────────────────────────
  const [sortBy, setSortBy] = useState('faelligkeit');
  const [sortDir, setSortDir] = useState('asc');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterBehandler, setFilterBehandler] = useState('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [allP, dayP, behandler, latRes, lonRes, addrRes] = await Promise.all([
        fetch(`${API_base}/patients/`).then(res => res.ok ? res.json() : []),
        fetch(`${API_base}/planner/today`).then(res => res.ok ? res.json() : { patients: [], routes_by_behandler: [], stats: { total_travel_time_minutes: 0, patient_count: 0 } }),
        fetch(`${API_base}/behandler/`).then(res => res.ok ? res.json() : []),
        fetch(`${API_base}/settings/praxis_lat`).then(r => r.ok ? r.json() : null),
        fetch(`${API_base}/settings/praxis_lon`).then(r => r.ok ? r.json() : null),
        fetch(`${API_base}/settings/praxis_address`).then(r => r.ok ? r.json() : null)
      ]);

      setPatients(allP);
      setTodaysPlan(dayP);
      setBehandlerList(behandler);

      if (latRes && lonRes) {
        setPraxisCoords([parseFloat(latRes.value), parseFloat(lonRes.value)]);
      }
      if (addrRes) {
        setPraxisAddress(addrRes.value);
      }
      // Load radius settings from plan response
      if (dayP?.radius_settings) {
        setRadiusFuss(dayP.radius_settings.fuss_km);
        setRadiusRad(dayP.radius_settings.rad_km);
      }
    } catch (err) {
      console.error("Failed to load data", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (loggedIn) loadData();
  }, [loggedIn, loadData]);

  // ─── Sorted & Filtered Patient List ────────────────────
  const sortedFilteredPatients = useMemo(() => {
    let list = [...patients];

    // Filter: text search
    if (filterSearch.trim()) {
      const q = filterSearch.toLowerCase();
      list = list.filter(p =>
        (p.nachname || '').toLowerCase().includes(q) ||
        (p.vorname || '').toLowerCase().includes(q) ||
        (p.address || '').toLowerCase().includes(q)
      );
    }

    // Filter: Behandler
    if (filterBehandler !== 'all') {
      if (filterBehandler === 'none') {
        list = list.filter(p => !p.primary_behandler_id);
      } else {
        const bId = parseInt(filterBehandler);
        list = list.filter(p => p.primary_behandler_id === bId || p.override_behandler_id === bId);
      }
    }

    // Sort
    const dir = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      switch (sortBy) {
        case 'nachname':
          return dir * (a.nachname || '').localeCompare(b.nachname || '', 'de');
        case 'vorname':
          return dir * (a.vorname || '').localeCompare(b.vorname || '', 'de');
        case 'faelligkeit': {
          const nextA = new Date(a.last_visit).getTime() + a.interval_days * 86400000;
          const nextB = new Date(b.last_visit).getTime() + b.interval_days * 86400000;
          return dir * (nextA - nextB);
        }
        case 'letzte_visite':
          return dir * (new Date(a.last_visit).getTime() - new Date(b.last_visit).getTime());
        case 'intervall':
          return dir * (a.interval_days - b.interval_days);
        default:
          return 0;
      }
    });

    return list;
  }, [patients, sortBy, sortDir, filterSearch, filterBehandler]);

  // ─── Out-of-radius patients (transport mode filter) ───
  const outOfRadiusPatients = useMemo(() => {
    const result = [];
    const planRoutes = todaysPlan.routes_by_behandler || [];
    planRoutes.forEach(route => {
      const mode = transportModes[route.behandler.id] || 'auto';
      if (mode === 'auto') return;
      const maxKm = mode === 'fuss' ? radiusFuss : radiusRad;
      route.patients.forEach(p => {
        const dist = p.distance_from_praxis_km;
        if (dist !== null && dist !== undefined && dist > maxKm) {
          result.push({ patient: p, behandler: route.behandler });
        }
      });
    });
    return result;
  }, [todaysPlan, transportModes, radiusFuss, radiusRad]);

  // ─── Handlers ──────────────────────────────────────────

  const handleAddPatient = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      vorname: formData.get('vorname'),
      nachname: formData.get('nachname'),
      address: formData.get('address'),
      is_einmalig: formData.get('is_einmalig') === 'on',
      // Force interval to 0 if one-time visit, otherwise use input value
      interval_days: formData.get('is_einmalig') === 'on' ? 0 : (parseInt(formData.get('interval')) || 7),
      visit_duration_minutes: parseInt(formData.get('duration')) || 30,
      primary_behandler_id: parseInt(formData.get('behandler')) || null,
    };
    try {
      const res = await fetch(`${API_base}/patients/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Fehler beim Anlegen: ${err.detail || res.statusText}`);
        return;
      }
      const created = await res.json();
      if (created.geocoding_warning) {
        alert(`⚠️ Patient angelegt, aber:\n\n${created.geocoding_warning}`);
      }
      e.target.reset();
      loadData();
    } catch (err) {
      alert(`Verbindung fehlgeschlagen: ${err.message}`);
    }
  };

  const handleUpdatePatient = async (id, data) => {
    try {
      const res = await fetch(`${API_base}/patients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Fehler beim Speichern: ${err.detail || res.statusText}`);
        return false;
      }
      const updated = await res.json();
      if (updated.geocoding_warning) {
        alert(`⚠️ Gespeichert, aber:\n\n${updated.geocoding_warning}`);
      }
      loadData();
      return true;
    } catch (err) {
      alert(`Verbindung fehlgeschlagen: ${err.message}`);
      return false;
    }
  };

  const handleDeletePatient = async (id) => {
    if (window.confirm("Patient wirklich löschen?")) {
      await fetch(`${API_base}/patients/${id}`, { method: 'DELETE' });
      loadData();
    }
  };

  const handleVisitDone = async (id) => {
    const p = patients.find(p => p.id === id);
    if (p && p.is_einmalig) {
      if (!window.confirm(`⚠️ ACHTUNG: Der Patient "${p.nachname}, ${p.vorname}" ist als 'Einmalig' markiert.\n\nWenn Sie den Besuch als erledigt markieren, werden ALLE DATEN dieses Patienten ENDGÜLTIG GELÖSCHT.\n\nFortfahren?`)) {
        return;
      }
    }
    await fetch(`${API_base}/patients/${id}/visit`, { method: 'PUT' });
    loadData();
  };

  const handleSchedule = async (id) => {
    await fetch(`${API_base}/patients/${id}/schedule`, { method: 'POST' });
    loadData();
  };

  const handleUnschedule = async (id) => {
    await fetch(`${API_base}/patients/${id}/unschedule`, { method: 'POST' });
    loadData();
  };

  const handleOverrideBehandler = async (patientId, behandlerId, permanent) => {
    await fetch(`${API_base}/patients/${patientId}/override-behandler`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ behandler_id: behandlerId, permanent })
    });
    loadData();
  };

  const handleLogout = async () => {
    await fetch(`${API_base}/auth/logout`, { method: 'POST' });
    setLoggedIn(false);
  };

  const handleExport = () => {
    const date = new Date().toLocaleDateString();
    let text = `Hausbesuchsplan für ${date}\n\n`;
    text += `Start: ${praxisAddress}\n`;
    text += `────────────────────────────────────────\n\n`;

    const routes = todaysPlan.routes_by_behandler || [];
    routes.forEach(route => {
      text += `▸ ${route.behandler.name} (${route.behandler.rolle})\n`;
      text += `  Geschätzte Fahrzeit: ${route.stats.total_travel_time_minutes} Min\n\n`;
      route.patients.forEach((p, i) => {
        text += `  ${i + 1}. ${displayName(p)}\n`;
        text += `     ${p.address}\n`;
        text += `     ⏱️ ${p.visit_duration_minutes} min\n\n`;
      });
      text += `────────────────────────────────────────\n\n`;
    });

    text += `Ende: ${praxisAddress}\n`;

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Hausbesuche_${date.replace(/\./g, '-')}.txt`;
    a.click();
  };

  const handleLocationUpdate = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      address: fd.get('address'),
      city: fd.get('city')
    };
    try {
      const res = await fetch(`${API_base}/settings/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`⚠️ Geocoding-Fehler:\n\n${err.detail || 'Adresse konnte nicht gefunden werden.'}`);
        loadData(); // Adresstext wurde trotzdem gespeichert
        return;
      }
      alert('Standort gespeichert!');
      loadData();
    } catch (err) {
      alert(`Verbindung fehlgeschlagen: ${err.message}`);
    }
  };

  const handleSaveRadius = async (e) => {
    e.preventDefault();
    try {
      await Promise.all([
        fetch(`${API_base}/settings/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'radius_fuss', value: String(radiusFuss) })
        }),
        fetch(`${API_base}/settings/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'radius_rad', value: String(radiusRad) })
        })
      ]);
      alert('Radius-Einstellungen gespeichert!');
    } catch (err) {
      alert(`Verbindung fehlgeschlagen: ${err.message}`);
    }
  };

  const getTransportMode = (behandlerId) => transportModes[behandlerId] || 'auto';
  const setTransportModeFor = (behandlerId, mode) => {
    setTransportModes(prev => ({ ...prev, [behandlerId]: mode }));
  };

  // ─── Behandler Handlers ────────────────────────────────

  const handleAddBehandler = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      name: fd.get('name'),
      rolle: fd.get('rolle'),
      farbe: fd.get('farbe') || '#33656E',
      max_daily_minutes: parseInt(fd.get('max_daily_minutes')) || 240,
    };
    try {
      const res = await fetch(`${API_base}/behandler/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Fehler: ${err.detail || res.statusText}`);
        return;
      }
      e.target.reset();
      loadData();
    } catch (err) {
      alert(`Verbindung fehlgeschlagen: ${err.message}`);
    }
  };

  const handleDeleteBehandler = async (id) => {
    if (window.confirm("Behandler wirklich löschen? Patienten behalten ihren Eintrag, werden aber als 'Nicht zugewiesen' angezeigt.")) {
      await fetch(`${API_base}/behandler/${id}`, { method: 'DELETE' });
      loadData();
    }
  };

  const handleRestoreBackup = async (e) => {
    e.preventDefault();
    if (!window.confirm("⚠️ Wirklich wiederherstellen? \n\nDie AKTUELLE Datenbank wird ÜBERSCHRIEBEN! Alle nicht gesicherten Daten gehen verloren.")) {
      return;
    }

    const fd = new FormData(e.target);
    try {
      const res = await fetch(`${API_base}/backup/import`, {
        method: 'POST',
        body: fd
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || res.statusText);
      }

      const msg = await res.json();
      alert(msg.message);
      window.location.reload();

    } catch (err) {
      alert(`Fehler beim Wiederherstellen: ${err.message}`);
    }
  };

  // ─── Sort Toggle Helper ────────────────────────────────
  const handleSortToggle = (field) => {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
  };

  // ─── Render Logic ──────────────────────────────────────

  if (!loggedIn) {
    return <LoginScreen onLoggedIn={() => setLoggedIn(true)} />;
  }

  const routes = todaysPlan.routes_by_behandler || [];
  const displayPatients = todaysPlan.patients || [];
  const totalTravelTime = todaysPlan.stats?.total_travel_time_minutes || 0;
  const totalVisitTime = displayPatients.reduce((acc, p) => acc + p.visit_duration_minutes, 0);
  const totalTime = totalVisitTime + totalTravelTime;

  // Helper: get daily time for a Behandler (override > profile default > 240)
  const getDailyTime = (behandlerId, defaultMinutes) => {
    if (dailyTimeOverrides[behandlerId] !== undefined) return dailyTimeOverrides[behandlerId];
    return defaultMinutes || 240;
  };
  const setDailyTime = (behandlerId, minutes) => {
    setDailyTimeOverrides(prev => ({ ...prev, [behandlerId]: minutes }));
  };

  // Check if any Behandler is over time
  const totalAvailable = routes.reduce((sum, r) => sum + getDailyTime(r.behandler.id, r.behandler.max_daily_minutes), 0);
  const isOverTime = totalTime > totalAvailable;

  return (
    <div className="container">
      <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <img src="/logo.png" alt="VisiCycle Logo" style={{ height: '60px' }} />
          <div>
            <h1 style={{ color: 'var(--color-primary)', lineHeight: 1, marginBottom: '0.25rem' }}>VisiCycle</h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', margin: 0 }}>Intelligente Hausbesuchs-Planung</p>
          </div>
        </div>
        <nav style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button className={`btn ${view !== 'dashboard' ? 'btn-secondary' : ''}`} onClick={() => setView('dashboard')}>
            Tagesplan
          </button>
          <button className={`btn ${view !== 'patients' ? 'btn-secondary' : ''}`} onClick={() => setView('patients')}>
            Alle Patienten
          </button>
          <button className={`btn ${view !== 'settings' ? 'btn-secondary' : ''}`} onClick={() => setView('settings')}>
            ⚙️ Einstellungen
          </button>
          <button className="btn btn-secondary" onClick={handleLogout} title="Abmelden" style={{ color: '#dc2626' }}>
            🔒 Abmelden
          </button>
        </nav>
      </header>

      <main>
        {/* ─── DASHBOARD ─────────────────────────────── */}
        {view === 'dashboard' && (
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <h2 style={{ marginBottom: 0 }}>Tagesplan</h2>
                <button onClick={handleExport} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>📄 Export TXT</button>
              </div>
            </div>

            {/* Time Summary */}
            <div className="card" style={{ padding: '1rem', marginBottom: '2rem', backgroundColor: isOverTime ? '#fee2e2' : '#f0f9ff', borderColor: isOverTime ? '#fca5a5' : '#bae6fd' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span style={{ color: isOverTime ? '#991b1b' : 'var(--color-primary)' }}>
                  Gesamtdauer: ~{Math.floor(totalTime / 60)}h {totalTime % 60}m
                </span>
                <span>
                  {totalVisitTime}m Visite + {totalTravelTime}m Fahrt (geschätzt)
                </span>
              </div>
              {isOverTime && (
                <p style={{ color: '#dc2626', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                  ⚠️ Achtung: Zeitbudget bei mindestens einem Behandler überschritten! Eventuell Patienten umverteilen.
                </p>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '2rem' }}>
              {/* List Side – grouped by Behandler */}
              <div style={{ display: 'grid', gap: '1.5rem', alignContent: 'start' }}>
                {routes.length === 0 ? (
                  <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                    <p>Keine Besuche für heute geplant! 🎉</p>
                  </div>
                ) : (
                  routes.map((route, routeIdx) => (
                    <div key={routeIdx}>
                      <div style={{
                        display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '0.75rem',
                        padding: '0.75rem', borderRadius: '0.5rem',
                        background: `${route.behandler.farbe}15`,
                        borderLeft: `4px solid ${route.behandler.farbe}`
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: route.behandler.farbe, flexShrink: 0 }}></span>
                            <span style={{ fontWeight: 700 }}>{route.behandler.name}</span>
                            {route.behandler.rolle && (
                              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>({route.behandler.rolle})</span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}>
                            <span style={{ color: 'var(--color-text-muted)' }}>⏱️</span>
                            <input
                              type="number"
                              value={getDailyTime(route.behandler.id, route.behandler.max_daily_minutes)}
                              onChange={(e) => setDailyTime(route.behandler.id, parseInt(e.target.value) || 0)}
                              className="input"
                              style={{ width: '65px', padding: '0.15rem 0.3rem', fontSize: '0.8rem', textAlign: 'center', display: 'inline-block' }}
                              title="Verfügbare Minuten heute"
                            />
                            <span style={{ color: 'var(--color-text-muted)' }}>Min</span>
                          </div>
                        </div>

                        {/* Transport Mode Selector */}
                        {route.behandler.id && (
                          <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.25rem' }}>
                            {[
                              { mode: 'auto', label: '🚗 Auto' },
                              { mode: 'rad',  label: '🚲 Rad' },
                              { mode: 'fuss', label: '🚶 Fuß' },
                            ].map(({ mode, label }) => (
                              <button
                                key={mode}
                                onClick={() => setTransportModeFor(route.behandler.id, mode)}
                                className={`btn ${getTransportMode(route.behandler.id) === mode ? '' : 'btn-secondary'}`}
                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                                title={
                                  mode === 'auto' ? 'Kein Radius-Filter' :
                                  mode === 'rad'  ? `Max. ${radiusRad} km` :
                                                   `Max. ${radiusFuss} km`
                                }
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Workload Bar */}
                        {(() => {
                          const visitTime = route.patients.reduce((sum, p) => sum + p.visit_duration_minutes, 0);
                          const travelTime = route.stats.total_travel_time_minutes;
                          const total = visitTime + travelTime;
                          const max = getDailyTime(route.behandler.id, route.behandler.max_daily_minutes);
                          const isOver = total > max;
                          const percent = Math.min(100, (total / max) * 100);

                          return (
                            <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.15rem', color: isOver ? '#dc2626' : 'var(--color-text)' }}>
                                <span>{total} / {max} Min ({visitTime}m Visite + {travelTime}m Fahrt)</span>
                                {isOver && <span style={{ fontWeight: 'bold' }}>⚠️ +{total - max}m</span>}
                              </div>
                              <div style={{ height: '6px', background: 'rgba(0,0,0,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${percent}%`, background: isOver ? '#dc2626' : route.behandler.farbe, transition: 'width 0.3s ease' }}></div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                      <div style={{ display: 'grid', gap: '0.5rem' }}>
                        {(() => {
                          const mode = getTransportMode(route.behandler.id);
                          const maxKm = mode === 'fuss' ? radiusFuss : mode === 'rad' ? radiusRad : Infinity;
                          const visiblePatients = route.patients.filter(p => {
                            if (mode === 'auto') return true;
                            const dist = p.distance_from_praxis_km;
                            return dist === null || dist === undefined || dist <= maxKm;
                          });
                          return visiblePatients.map((p, idx) => (
                            <PatientCard
                              key={p.id}
                              patient={p}
                              idx={idx + 1}
                              onVisit={() => handleVisitDone(p.id)}
                              onUnschedule={() => handleUnschedule(p.id)}
                              isDue={true}
                              dashboardCompact={true}
                              behandlerList={behandlerList}
                              onOverrideBehandler={handleOverrideBehandler}
                              routeColor={route.behandler.farbe}
                            />
                          ));
                        })()}
                      </div>
                    </div>
                  ))
                )}

                {/* Out-of-radius patients */}
                {outOfRadiusPatients.length > 0 && (
                  <div>
                    <div style={{
                      marginBottom: '0.75rem',
                      padding: '0.75rem',
                      borderRadius: '0.5rem',
                      background: '#fef3c715',
                      borderLeft: '4px solid #f59e0b'
                    }}>
                      <span style={{ fontWeight: 700, color: '#92400e' }}>
                        ⚠️ Neu zuzuordnen ({outOfRadiusPatients.length})
                      </span>
                      <div style={{ fontSize: '0.8rem', color: '#92400e', marginTop: '0.25rem' }}>
                        Diese Patienten liegen außerhalb des gewählten Fortbewegungsradius.
                      </div>
                    </div>
                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                      {outOfRadiusPatients.map(({ patient: p }) => (
                        <PatientCard
                          key={`oor-${p.id}`}
                          patient={p}
                          onVisit={() => handleVisitDone(p.id)}
                          onUnschedule={() => handleUnschedule(p.id)}
                          isDue={true}
                          dashboardCompact={true}
                          behandlerList={behandlerList}
                          onOverrideBehandler={handleOverrideBehandler}
                          routeColor="#f59e0b"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Map Side */}
              <div className="card" style={{ height: '600px', padding: 0, overflow: 'hidden' }}>
                <MapContainer center={praxisCoords} zoom={13} style={{ height: '100%', width: '100%' }}>
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <RecenterMap coords={praxisCoords} />

                  {/* Praxis Marker */}
                  <Marker position={praxisCoords} icon={praxisIcon}>
                    <Popup>🏥 {praxisAddress} (Start/Ende)</Popup>
                  </Marker>

                  {/* Routes per Behandler with different colors */}
                  {routes.map((route, routeIdx) => {
                    const color = route.behandler.farbe || '#33656E';
                    const routePts = [
                      praxisCoords,
                      ...route.patients.filter(p => p.latitude && p.longitude).map(p => [p.latitude, p.longitude])
                    ];
                    const returnPts = routePts.length > 1 ? [routePts[routePts.length - 1], praxisCoords] : [];

                    return (
                      <React.Fragment key={routeIdx}>
                        {/* Patient markers */}
                        {route.patients.filter(p => p.latitude && p.longitude).map((p, idx) => (
                          <Marker key={p.id} position={[p.latitude, p.longitude]} icon={createColoredIcon(color)}>
                            <Popup>
                              <b>{idx + 1}. {displayName(p)}</b><br />
                              {p.address}<br />
                              <i>{p.visit_duration_minutes} min</i><br />
                              <span style={{ color }}>{route.behandler.name}</span>
                            </Popup>
                          </Marker>
                        ))}

                        {/* Route line */}
                        {routePts.length > 1 && (
                          <>
                            <Polyline positions={routePts} color={color} weight={4} opacity={0.8}>
                              <Popup>{route.behandler.name} – Hinweg</Popup>
                            </Polyline>
                            <Polyline positions={returnPts} color={color} dashArray="10, 10" weight={3} opacity={0.5}>
                              <Popup>{route.behandler.name} – Rückweg</Popup>
                            </Polyline>
                          </>
                        )}
                      </React.Fragment>
                    );
                  })}
                </MapContainer>
              </div>
            </div>

            {/* Text Route per Behandler */}
            <div style={{ marginTop: '2rem' }}>
              <h3>Text-Routen</h3>
              {routes.map((route, i) => (
                <div key={i} className="card" style={{ marginTop: '0.5rem' }}>
                  <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                    <span style={{ color: route.behandler.farbe }}>●</span> {route.behandler.name} ({route.behandler.rolle || '–'})
                  </p>
                  <p style={{ color: 'var(--color-text-muted)' }}>
                    Start: Praxis → {route.patients.map(p => displayName(p)).join(' → ')} → Praxis
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ─── ALL PATIENTS ──────────────────────────── */}
        {view === 'patients' && (
          <section>
            <h2 style={{ marginBottom: '1rem' }}>Alle Patienten ({patients.length})</h2>

            {/* Add Patient Form */}
            <div className="card" style={{ marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '1rem' }}>Neuen Patienten anlegen</h3>
              <form onSubmit={handleAddPatient} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '0.75rem', alignItems: 'end' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Nachname</label>
                  <input name="nachname" className="input" placeholder="z.B. Müller" required />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Vorname</label>
                  <input name="vorname" className="input" placeholder="z.B. Max" required />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Adresse</label>
                  <input name="address" className="input" placeholder="Straße Nr, Stadt" required />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Intervall (Tage)</label>
                  <input name="interval" type="number" className="input" defaultValue="7" required />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Dauer (Min)</label>
                  <input name="duration" type="number" className="input" defaultValue="30" required />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input name="is_einmalig" type="checkbox" style={{ marginRight: '0.5rem', width: '16px', height: '16px' }} />
                    Einmaliger Besuch
                  </label>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Primärer Behandler</label>
                  <select name="behandler" className="input">
                    <option value="">— Kein Behandler —</option>
                    {behandlerList.map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.rolle})</option>
                    ))}
                  </select>
                </div>
                <button className="btn" style={{ gridColumn: 'span 3' }}>+ Anlegen</button>
              </form>
            </div>

            {/* ─── Sort & Filter Bar ──────────────────── */}
            <div className="card" style={{ marginBottom: '1rem', padding: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Search */}
                <div style={{ flex: '1 1 200px' }}>
                  <input
                    type="text"
                    className="input"
                    placeholder="🔍 Name oder Adresse suchen..."
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>

                {/* Behandler Filter */}
                <div>
                  <select
                    className="input"
                    value={filterBehandler}
                    onChange={(e) => setFilterBehandler(e.target.value)}
                    style={{ fontSize: '0.85rem', width: 'auto', minWidth: '140px' }}
                  >
                    <option value="all">Alle Behandler</option>
                    <option value="none">Nicht zugewiesen</option>
                    {behandlerList.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.rolle})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sort Buttons */}
                <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                  {[
                    { key: 'nachname', label: 'Nachname' },
                    { key: 'vorname', label: 'Vorname' },
                    { key: 'faelligkeit', label: 'Fälligkeit' },
                    { key: 'letzte_visite', label: 'Letzte Visite' },
                    { key: 'intervall', label: 'Intervall' },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => handleSortToggle(opt.key)}
                      className={`btn ${sortBy === opt.key ? '' : 'btn-secondary'}`}
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                    >
                      {opt.label} {sortBy === opt.key ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                    </button>
                  ))}
                </div>
              </div>

              {/* Result count */}
              {(filterSearch || filterBehandler !== 'all') && (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                  {sortedFilteredPatients.length} von {patients.length} Patienten angezeigt
                </p>
              )}
            </div>

            {/* Patient List */}
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {sortedFilteredPatients.map(p => (
                <PatientCard
                  key={p.id}
                  patient={p}
                  onSchedule={() => handleSchedule(p.id)}
                  onUnschedule={() => handleUnschedule(p.id)}
                  onEdit={setEditingPatient}
                  onDelete={handleDeletePatient}
                  compact={true}
                  isOnPlan={displayPatients.some(dp => dp.id === p.id)}
                  behandlerList={behandlerList}
                  onOverrideBehandler={handleOverrideBehandler}
                />
              ))}
              {sortedFilteredPatients.length === 0 && (
                <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                  {filterSearch || filterBehandler !== 'all' ? 'Keine Patienten gefunden.' : 'Noch keine Patienten angelegt.'}
                </div>
              )}
            </div>

            {editingPatient && (
              <EditPatientModal
                patient={editingPatient}
                onClose={() => setEditingPatient(null)}
                onSave={handleUpdatePatient}
                behandlerList={behandlerList}
              />
            )}
          </section>
        )}

        {/* ─── SETTINGS ──────────────────────────────── */}
        {view === 'settings' && (
          <section>
            <h2 style={{ marginBottom: '1rem' }}>Einstellungen</h2>

            {/* Praxis Location & Backup */}
            <div className="card" style={{ marginBottom: '2rem' }}>

              {/* Praxis Location */}
              <div style={{ marginTop: '0.5rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>📍 Praxisstandort</h3>
                <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
                  Geben Sie hier die Adresse Ihrer Praxis ein. Diese wird als Startpunkt für die Routenplanung verwendet.
                </p>
                <form onSubmit={handleLocationUpdate} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  <input name="address" placeholder="Straße Hausnummer" className="input" required style={{ flex: 2 }} />
                  <input name="city" placeholder="PLZ Stadt" className="input" required style={{ flex: 1 }} />
                  <button className="btn">Speichern</button>
                </form>
                {praxisCoords && praxisCoords[0] !== DEFAULT_COORDS[0] && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    Aktueller Standort: <b>{praxisAddress}</b> · Koordinaten: {praxisCoords[0].toFixed(5)}, {praxisCoords[1].toFixed(5)}
                  </div>
                )}
              </div>

              {/* Radius Settings */}
              <div style={{ marginTop: '2rem', borderTop: '1px solid var(--color-border)', paddingTop: '2rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>🚶 Fortbewegungsradius</h3>
                <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
                  Maximale Entfernung (Luftlinie) von der Praxis für Fuß- und Fahrradbesuche.
                  Patienten außerhalb dieses Radius werden im Tagesplan in die Spalte "Neu zuzuordnen" verschoben,
                  wenn der entsprechende Fortbewegungsmodus aktiv ist.
                </p>
                <form onSubmit={handleSaveRadius} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.75rem', alignItems: 'end' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                      🚶 Zu Fuß (km)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      className="input"
                      value={radiusFuss}
                      onChange={(e) => setRadiusFuss(parseFloat(e.target.value) || 1)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                      🚲 Mit Fahrrad (km)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      className="input"
                      value={radiusRad}
                      onChange={(e) => setRadiusRad(parseFloat(e.target.value) || 3)}
                    />
                  </div>
                  <button className="btn" type="submit">Speichern</button>
                </form>
              </div>

              {/* Backup Section */}
              <div style={{ marginTop: '3rem', borderTop: '1px solid var(--color-border)', paddingTop: '2rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>💾 Datensicherung</h3>
                <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
                  Hier können Sie eine Sicherheitskopie Ihrer Datenbank erstellen oder ein Backup wiederherstellen.
                </p>

                <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1fr 1fr' }}>
                  <div className="card" style={{ padding: '1rem', backgroundColor: 'var(--color-bg)' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0' }}>Backup erstellen</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
                      Laden Sie die aktuelle Datenbank herunter.
                    </p>
                    <a href={`${API_base}/backup/export`} target="_blank" rel="noopener noreferrer" className="btn" style={{ textDecoration: 'none', display: 'inline-block', textAlign: 'center', width: '100%' }}>
                      ⬇️ Datenbank herunterladen
                    </a>
                  </div>

                  <div className="card" style={{ padding: '1rem', backgroundColor: 'var(--color-bg)' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0' }}>Backup wiederherstellen</h4>
                    <p style={{ fontSize: '0.8rem', marginBottom: '1rem', color: '#dc2626' }}>
                      ⚠️ ACHTUNG: Überschreibt die aktuelle Datenbank!
                    </p>
                    <form onSubmit={handleRestoreBackup} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <input name="file" type="file" required accept=".sqlite3" style={{ fontSize: '0.9rem' }} />
                      <button className="btn btn-secondary" style={{ backgroundColor: '#dc2626', color: 'white', border: 'none' }}>
                        ♻️ Wiederherstellen
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>

            {/* Behandler Management */}
            <div className="card" style={{ marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '1rem' }}>👥 Behandler verwalten</h3>
              <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
                Hier können Sie Ärzte, VERAHs, PCMs und andere Behandler anlegen. Jeder Behandler bekommt eine eigene Route im Tagesplan.
              </p>

              {/* Add Behandler Form */}
              <form onSubmit={handleAddBehandler} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px auto auto', gap: '0.75rem', alignItems: 'end', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Name</label>
                  <input name="name" className="input" placeholder="z.B. Dr. Schmidt" required />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Rolle</label>
                  <select name="rolle" className="input" required>
                    <option value="Arzt">Arzt</option>
                    <option value="VERAH">VERAH</option>
                    <option value="PCM">PCM</option>
                    <option value="Pflegekraft">Pflegekraft</option>
                    <option value="Sonstige">Sonstige</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Zeit (Min)</label>
                  <input name="max_daily_minutes" type="number" defaultValue="240" className="input" placeholder="240" />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Farbe</label>
                  <input name="farbe" type="color" defaultValue="#33656E" className="input" style={{ width: '50px', height: '38px', padding: '2px', cursor: 'pointer' }} />
                </div>
                <button className="btn" style={{ height: '38px' }}>+ Hinzufügen</button>
              </form>

              {/* Behandler List */}
              {behandlerList.length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Noch keine Behandler angelegt.</p>
              ) : (
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {behandlerList.map(b => (
                    <div key={b.id} className="card" style={{ padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--color-bg)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: b.farbe, flexShrink: 0, border: '2px solid var(--color-border)' }}></span>
                        <div>
                          <span style={{ fontWeight: 600 }}>{b.name}</span>
                          <span className="badge badge-green" style={{ marginLeft: '0.5rem', fontSize: '0.7rem' }}>{b.rolle}</span>
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginLeft: '0.5rem' }}>⏱️ {b.max_daily_minutes || 240} min</span>
                        </div>
                      </div>
                      <button onClick={() => handleDeleteBehandler(b.id)} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', color: '#dc2626' }} title="Löschen">🗑️</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Security Info */}
            <div className="card">
              <h3 style={{ marginBottom: '1rem' }}>🔒 Sicherheit</h3>
              <p style={{ color: 'var(--color-text-muted)' }}>
                Alle Patientennamen und Adressen werden mit AES-Verschlüsselung in der Datenbank gespeichert.
                Die Daten können nur mit dem Master-Passwort entschlüsselt werden.
              </p>
              <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                ⚠️ <b>Wichtig:</b> Wenn Sie das Passwort vergessen, können die Daten nicht wiederhergestellt werden!
              </p>
            </div>
          </section>
        )}
      </main>
    </div >
  );
}


// ─── EDIT PATIENT MODAL ──────────────────────────────────

function EditPatientModal({ patient, onClose, onSave, behandlerList = [] }) {
  const handleSubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      vorname: fd.get('vorname'),
      nachname: fd.get('nachname'),
      address: fd.get('address'),
      is_einmalig: fd.get('is_einmalig') === 'on',
      interval_days: fd.get('is_einmalig') === 'on' ? 0 : parseInt(fd.get('interval')),
      visit_duration_minutes: parseInt(fd.get('duration')) || 30,
      primary_behandler_id: parseInt(fd.get('behandler')) || 0,
    };
    const success = await onSave(patient.id, data);
    if (success !== false) onClose();
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
      <div className="card" style={{ width: '100%', maxWidth: '500px', backgroundColor: 'var(--color-surface)' }}>
        <h3>Patient bearbeiten</h3>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Nachname</label>
              <input name="nachname" className="input" defaultValue={patient.nachname} placeholder="Nachname" required />
            </div>
            <div>
              <label className="label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Vorname</label>
              <input name="vorname" className="input" defaultValue={patient.vorname} placeholder="Vorname" required />
            </div>
          </div>
          <div>
            <label className="label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Adresse</label>
            <input name="address" className="input" defaultValue={patient.address} placeholder="Adresse" required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Intervall (Tage)</label>
              <input name="interval" type="number" className="input" defaultValue={patient.interval_days} />
            </div>
            <div>
              <label className="label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Dauer (Min)</label>
              <input name="duration" type="number" className="input" defaultValue={patient.visit_duration_minutes} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input name="is_einmalig" type="checkbox" defaultChecked={patient.is_einmalig} style={{ marginRight: '0.5rem', width: '16px', height: '16px' }} />
              Einmaliger Besuch (wird nach Erledigung gelöscht)
            </label>
          </div>
          <div>
            <label className="label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Primärer Behandler</label>
            <select name="behandler" className="input" defaultValue={patient.primary_behandler_id || ''}>
              <option value="">— Kein Behandler —</option>
              {behandlerList.map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.rolle})</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Abbrechen</button>
            <button type="submit" className="btn">Speichern</button>
          </div>
        </form>
      </div>
    </div>
  );
}


// ─── PATIENT CARD ────────────────────────────────────────

function PatientCard({ patient, idx, onVisit, onSchedule, onUnschedule, onEdit, onDelete, isDue, compact, dashboardCompact, isOnPlan, behandlerList = [], onOverrideBehandler, routeColor }) {
  const [showOverride, setShowOverride] = useState(false);

  const lastVisit = new Date(patient.last_visit).toLocaleDateString();
  const nextVisit = new Date(new Date(patient.last_visit).getTime() + patient.interval_days * 86400000);
  const daysUntil = Math.ceil((nextVisit - new Date()) / (1000 * 60 * 60 * 24));

  let statusColor = 'badge-green';
  let statusText = 'OK';

  const isManuallyPlanned = patient.planned_visit_date &&
    new Date(patient.planned_visit_date).toDateString() === new Date().toDateString();

  if (isManuallyPlanned) {
    statusColor = 'badge-yellow';
    statusText = 'Heute (Manuell)';
  } else if (daysUntil < 0) {
    statusColor = 'badge-red';
    statusText = `Überfällig (${Math.abs(daysUntil)}d)`;
  } else if (daysUntil === 0) {
    statusColor = 'badge-yellow';
    statusText = 'Heute fällig';
  } else {
    statusText = `in ${daysUntil}d`;
  }

  // Behandler info
  const primaryBehandler = patient.primary_behandler;
  const overrideBehandler = patient.override_behandler;
  const effectiveBehandler = overrideBehandler || primaryBehandler;

  const name = displayName(patient);

  // Compact View for "All Patients" list
  if (compact) {
    return (
      <div className="card" style={{ padding: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 'bold' }}>{name}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{patient.address}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>
              Letzte Visite: {lastVisit} · {patient.is_einmalig ? <b>Einmalig</b> : `Intervall: ${patient.interval_days}d`} · Dauer: {patient.visit_duration_minutes}min
            </div>
            {effectiveBehandler && (
              <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                <span style={{ color: effectiveBehandler.farbe || 'var(--color-primary)' }}>●</span>{' '}
                {effectiveBehandler.name} ({effectiveBehandler.rolle})
                {overrideBehandler && <span style={{ color: 'var(--color-accent)', marginLeft: '0.25rem' }}>(einmalig)</span>}
              </div>
            )}
            {patient.is_einmalig && (
              <span className="badge badge-yellow" style={{ fontSize: '0.65rem', marginTop: '0.25rem', display: 'inline-block' }}>⚠️ Einmaliger Besuch</span>
            )}
            {(!patient.latitude || !patient.longitude) && (
              <span style={{ fontSize: '0.65rem', marginTop: '0.25rem', display: 'inline-block', background: '#fee2e2', color: '#dc2626', borderRadius: '0.25rem', padding: '0.1rem 0.4rem', fontWeight: 600 }}>📍 Keine Koordinaten</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span className={`badge ${statusColor}`} style={{ fontSize: '0.75rem' }}>{statusText}</span>
            {isOnPlan ? (
              <button onClick={onUnschedule} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} title="Vom Tagesplan entfernen">❌</button>
            ) : (
              <button onClick={onSchedule} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} title="Auf Tagesplan setzen">📅</button>
            )}
            <button onClick={() => setShowOverride(!showOverride)} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} title="Behandler ändern">👤</button>
            <button onClick={() => onEdit(patient)} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} title="Bearbeiten">✏️</button>
            <button onClick={() => onDelete(patient.id)} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', color: '#dc2626' }} title="Löschen">🗑️</button>
          </div>
        </div>

        {/* Override Behandler Dropdown */}
        {showOverride && behandlerList.length > 0 && (
          <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--color-bg)', borderRadius: '0.5rem', display: 'grid', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Behandler ändern:</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {behandlerList.map(b => (
                <div key={b.id} style={{ display: 'flex', gap: '0.25rem' }}>
                  <button
                    onClick={() => { onOverrideBehandler(patient.id, b.id, false); setShowOverride(false); }}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                    title="Einmalige Änderung (nur nächster Besuch)"
                  >
                    <span style={{ color: b.farbe }}>●</span> {b.name} (einmalig)
                  </button>
                  <button
                    onClick={() => { onOverrideBehandler(patient.id, b.id, true); setShowOverride(false); }}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                    title="Dauerhafte Änderung"
                  >
                    dauerhaft
                  </button>
                </div>
              ))}
              {(overrideBehandler) && (
                <button
                  onClick={() => { onOverrideBehandler(patient.id, null, false); setShowOverride(false); }}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', color: '#dc2626' }}
                >
                  Einmal-Zuweisung entfernen
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Dashboard Compact View
  if (dashboardCompact) {
    return (
      <div className="card" style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', borderLeft: routeColor ? `4px solid ${routeColor}` : undefined }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{idx}. {name}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{patient.address}</div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={onVisit} className="btn" style={{ padding: '0.25rem 0.75rem', fontSize: '0.9rem' }}>✅ Erledigt</button>
            {onUnschedule && <button onClick={onUnschedule} className="btn btn-secondary" style={{ padding: '0.25rem 0.75rem' }} title="Verschieben">❌</button>}
            <button onClick={() => setShowOverride(!showOverride)} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} title="Behandler ändern">👤</button>
          </div>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <span>⏱️ {patient.visit_duration_minutes} min</span>
          {patient.distance_from_praxis_km != null && <span style={{ color: 'var(--color-text-muted)' }}>📏 {patient.distance_from_praxis_km} km</span>}
          {(!patient.latitude || !patient.longitude) && <span style={{ background: '#fee2e2', color: '#dc2626', borderRadius: '0.25rem', padding: '0.1rem 0.4rem', fontWeight: 600, fontSize: '0.7rem' }}>📍 Keine Koordinaten</span>}
          {patient.is_einmalig && <span className="badge badge-yellow" style={{ fontSize: '0.7rem' }}>⚠️ Einmaliger Besuch</span>}
          {overrideBehandler && <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>⚠️ Einmalig: {overrideBehandler.name}</span>}
          {isManuallyPlanned && <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>📌 Manuell eingeplant</span>}
        </div>

        {/* Override Dropdown in Dashboard */}
        {showOverride && behandlerList.length > 0 && (
          <div style={{ padding: '0.5rem', background: 'var(--color-bg)', borderRadius: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {behandlerList.map(b => (
              <div key={b.id} style={{ display: 'flex', gap: '0.25rem' }}>
                <button
                  onClick={() => { onOverrideBehandler(patient.id, b.id, false); setShowOverride(false); }}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.7rem', padding: '0.2rem 0.4rem' }}
                >
                  <span style={{ color: b.farbe }}>●</span> {b.name} (einmalig)
                </button>
                <button
                  onClick={() => { onOverrideBehandler(patient.id, b.id, true); setShowOverride(false); }}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.7rem', padding: '0.2rem 0.4rem' }}
                >
                  dauerhaft
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Fallback Detailed View
  return (
    <div className="card" style={{ position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem' }}>{idx ? `${idx}. ` : ''}{name}</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>{patient.address}</p>
        </div>
        <span className={`badge ${statusColor}`}>{statusText}</span>
      </div>
      <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.9rem' }}>
        <div>
          <span style={{ color: 'var(--color-text-muted)' }}>Letzter Besuch:</span>
          <div>{lastVisit}</div>
        </div>
        <div>
          <span style={{ color: 'var(--color-text-muted)' }}>Intervall:</span>
          <div>{patient.is_einmalig ? <b>Einmalig</b> : `${patient.interval_days} Tage`}</div>
        </div>
      </div>
      {isDue ? (
        <div style={{ marginTop: '1rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem', display: 'flex', gap: '0.5rem' }}>
          <button onClick={onVisit} className="btn" style={{ flex: 1 }}>Besuch erledigt ✅</button>
          {onUnschedule && (
            <button onClick={onUnschedule} className="btn btn-secondary" style={{ padding: '0 1rem' }} title="Verschieben / Nicht heute">❌</button>
          )}
        </div>
      ) : (
        !isManuallyPlanned && (
          <div style={{ marginTop: '1rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
            <button onClick={onSchedule} className="btn btn-secondary" style={{ width: '100%', fontSize: '0.875rem' }}>
              📅 Heute einplanen
            </button>
          </div>
        )
      )}
    </div>
  );
}

export default App;
