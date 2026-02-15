import React, { useState, useEffect } from 'react';
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

// Red Icon for Praxis
const redIcon = new L.Icon({
  iconUrl: '/marker-red.png',
  shadowUrl: '/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

const API_base = 'http://localhost:8000';

// Default Fallback
const DEFAULT_COORDS = [49.79245, 9.93296];

function RecenterMap({ coords }) {
  const map = useMap();
  useEffect(() => {
    map.setView(coords, map.getZoom());
  }, [coords]);
  return null;
}

function App() {
  const [patients, setPatients] = useState([]);
  const [todaysPlan, setTodaysPlan] = useState([]);
  const [view, setView] = useState('dashboard'); // 'dashboard', 'patients', 'settings'
  const [loading, setLoading] = useState(true);
  const [availableTime, setAvailableTime] = useState(480); // 8 hours in minutes
  const [praxisCoords, setPraxisCoords] = useState(DEFAULT_COORDS);
  const [praxisAddress, setPraxisAddress] = useState("Praxis");
  const [editingPatient, setEditingPatient] = useState(null);

  // Load data
  const loadData = async () => {
    setLoading(true);
    try {
      // Parallel fetch
      const [allP, dayP, latRes, lonRes, addrRes] = await Promise.all([
        fetch(`${API_base}/patients/`).then(res => res.json()),
        fetch(`${API_base}/planner/today`).then(res => res.json()),
        fetch(`${API_base}/settings/praxis_lat`).then(r => r.ok ? r.json() : null),
        fetch(`${API_base}/settings/praxis_lon`).then(r => r.ok ? r.json() : null),
        fetch(`${API_base}/settings/praxis_address`).then(r => r.ok ? r.json() : null)
      ]);

      // Sort all patients by due date (overdue first)
      const sortedPatients = allP.sort((a, b) => {
        const nextA = new Date(new Date(a.last_visit).getTime() + a.interval_days * 86400000);
        const nextB = new Date(new Date(b.last_visit).getTime() + b.interval_days * 86400000);
        return nextA - nextB;
      });

      setPatients(sortedPatients);
      setTodaysPlan(dayP);

      if (latRes && lonRes) {
        setPraxisCoords([parseFloat(latRes.value), parseFloat(lonRes.value)]);
      }
      if (addrRes) {
        setPraxisAddress(addrRes.value);
      }

    } catch (err) {
      console.error("Failed to load data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddPatient = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      name: formData.get('name'),
      address: formData.get('address'),
      interval_days: parseInt(formData.get('interval')),
      visit_duration_minutes: parseInt(formData.get('duration'))
    };

    await fetch(`${API_base}/patients/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    e.target.reset();
    loadData(); // Refresh list
  };

  const handleUpdatePatient = async (id, data) => {
    await fetch(`${API_base}/patients/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    loadData();
  };

  const handleDeletePatient = async (id) => { // Confirm handled in UI or just do it
    if (window.confirm("Patient wirklich löschen?")) {
      await fetch(`${API_base}/patients/${id}`, { method: 'DELETE' });
      loadData();
    }
  };

  const handleVisitDone = async (id) => {
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
  }

  const handleExport = () => {
    const date = new Date().toLocaleDateString();
    let text = `Hausbesuchsplan für ${date}\n\n`;
    text += `Start: ${praxisAddress}\n`;
    text += `----------------------------------------\n`;

    // Access current list
    let list = [];
    if (Array.isArray(todaysPlan)) {
      list = todaysPlan;
    } else if (todaysPlan.patients) {
      list = todaysPlan.patients;
    }

    list.forEach((p, i) => {
      text += `${i + 1}. ${p.name}\n`;
      text += `   ${p.address}\n`;
      text += `   Hinweis: ${p.visit_duration_minutes} min eingeplant\n\n`;
    });

    text += `----------------------------------------\n`;
    text += `Ende: ${praxisAddress}\n`;

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Hausbesuche_${date}.txt`;
    a.click();
  };

  const handleLocationUpdate = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      address: fd.get('address'),
      city: fd.get('city')
    };
    await fetch(`${API_base}/settings/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    alert('Standort gespeichert!');
    loadData(); // Refresh to get new coords
  };

  // ... stats calculation code ...

  // Calculate Stats
  // Use stats from backend if available, otherwise fallback

  let displayPatients = [];
  let totalTravelTime = 0;

  // We need to handle the new response format { patients: [], stats: {} }
  if (Array.isArray(todaysPlan)) { // Fallback for old format or empty array
    displayPatients = todaysPlan;
    totalTravelTime = (todaysPlan.length + 1) * 15; // Rough travel estimation: 15 min per patient + 15 min start/end
  } else if (todaysPlan.patients) { // New format
    displayPatients = todaysPlan.patients;
    totalTravelTime = todaysPlan.stats.total_travel_time_minutes;
  }

  const totalVisitTime = displayPatients.reduce((acc, p) => acc + p.visit_duration_minutes, 0);
  const totalTime = totalVisitTime + totalTravelTime;
  const isOverTime = totalTime > availableTime;

  // Prepare Route for Map
  // Start at Praxis -> all patients -> (optional: return to Praxis?)
  // Using lat/lon. Filter out patients with missing coords.
  const routePoints = [praxisCoords, ...displayPatients.filter(p => p.latitude && p.longitude).map(p => [p.latitude, p.longitude])];

  // Return path (Last patient -> Praxis)
  const returnPath = [];
  if (routePoints.length > 1) {
    returnPath.push(routePoints[routePoints.length - 1]);
    returnPath.push(praxisCoords);
  }

  return (
    <div className="container">
      <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ color: '#0369a1' }}>VisiCycle</h1>
          <p style={{ color: 'var(--color-text-muted)' }}>Intelligente Hausbesuchs-Planung</p>
        </div>
        <nav style={{ display: 'flex', gap: '1rem' }}>
          <button
            className={`btn ${view !== 'dashboard' ? 'btn-secondary' : ''}`}
            onClick={() => setView('dashboard')}
          >
            Tagesplan
          </button>
          <button
            className={`btn ${view !== 'patients' ? 'btn-secondary' : ''}`}
            onClick={() => setView('patients')}
          >
            Alle Patienten
          </button>
          <button
            className={`btn ${view !== 'settings' ? 'btn-secondary' : ''}`}
            onClick={() => setView('settings')}
          >
            ⚙️ Einstellung
          </button>
        </nav>
      </header>

      <main>
        {view === 'dashboard' && (
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <h2 style={{ marginBottom: 0 }}>Fällige Besuche für heute</h2>
                <button onClick={handleExport} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>📄 Export TXT</button>
              </div>
              <div style={{ textAlign: 'right' }}>
                <label style={{ marginRight: '0.5rem', fontSize: '0.9rem' }}>Verfügbare Zeit (Min):</label>
                <input
                  type="number"
                  value={availableTime}
                  onChange={(e) => setAvailableTime(parseInt(e.target.value) || 0)}
                  className="input"
                  style={{ width: '80px', display: 'inline-block' }}
                />
              </div>
            </div>

            {/* Time Summary Bar */}
            <div className="card" style={{ padding: '1rem', marginBottom: '2rem', backgroundColor: isOverTime ? '#fee2e2' : '#f0f9ff', borderColor: isOverTime ? '#fca5a5' : '#bae6fd' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600' }}>
                <span style={{ color: isOverTime ? '#991b1b' : '#0369a1' }}>
                  Gesamtdauer: ~{Math.floor(totalTime / 60)}h {totalTime % 60}m
                </span>
                <span>
                  {totalVisitTime}m Visite + {totalTravelTime}m Fahrt (geschätzt)
                </span>
              </div>
              {isOverTime && (
                <p style={{ color: '#dc2626', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                  ⚠️ Achtung: Zeit überschritten um {totalTime - availableTime} Minuten! Eventuell Patienten verschieben.
                </p>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '2rem' }}>
              {/* List Side */}
              <div style={{ display: 'grid', gap: '1rem', alignContent: 'start' }}>
                {displayPatients.length === 0 ? (
                  <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                    <p>Keine Besuche für heute geplant! 🎉</p>
                  </div>
                ) : (
                  displayPatients.map((p, idx) => (
                    <PatientCard
                      key={p.id}
                      patient={p}
                      idx={idx + 1}
                      onVisit={() => handleVisitDone(p.id)}
                      onUnschedule={() => handleUnschedule(p.id)}
                      isDue={true}
                      dashboardCompact={true}
                    />
                  ))
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
                  <Marker position={praxisCoords} icon={redIcon}>
                    <Popup>🏥 {praxisAddress} (Start/Ende)</Popup>
                  </Marker>

                  {/* Patient Markers */}
                  {displayPatients.filter(p => p.latitude && p.longitude).map((p, idx) => (
                    <Marker key={p.id} position={[p.latitude, p.longitude]}>
                      <Popup>
                        <b>{idx + 1}. {p.name}</b><br />
                        {p.address}<br />
                        <i>{p.visit_duration_minutes} min</i>
                      </Popup>
                    </Marker>
                  ))}

                  {/* Route Line */}
                  {routePoints.length > 1 && (
                    <>
                      <Polyline positions={routePoints} color="var(--color-primary)" weight={4} opacity={0.8}>
                        <Popup>Hinweg</Popup>
                      </Polyline>
                      {/* Return Path (Dashed) */}
                      <Polyline positions={returnPath} color="gray" dashArray="10, 10" weight={3} opacity={0.6}>
                        <Popup>Rückweg zur Praxis</Popup>
                      </Polyline>
                    </>
                  )}
                </MapContainer>
              </div>
            </div>

            <div style={{ marginTop: '2rem' }}>
              <h3>Text-Route</h3>
              <div className="card" style={{ marginTop: '1rem' }}>
                <p style={{ color: 'var(--color-text-muted)' }}>
                  Start: Praxis → {displayPatients.map(p => p.name).join(' → ')} → Praxis
                </p>
              </div>
            </div>
          </section>
        )}

        {view === 'patients' && (
          <section>
            <h2 style={{ marginBottom: '1rem' }}>Alle Patienten ({patients.length})</h2>
            <div className="card" style={{ marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '1rem' }}>Neuen Patienten anlegen</h3>
              <form onSubmit={handleAddPatient} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: '1rem', alignItems: 'end' }}>
                <input name="name" className="input" placeholder="Name (z.B. Max Muster)" required />
                <input name="address" className="input" placeholder="Adresse" required />
                <input name="interval" type="number" className="input" placeholder="Intervall" defaultValue="7" style={{ width: '80px' }} required />
                <input name="duration" type="number" className="input" placeholder="Dauer" defaultValue="30" style={{ width: '80px' }} required />
                <button className="btn" style={{ gridColumn: 'span 4' }}>+ Anlegen</button>
              </form>
            </div>

            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {patients.map(p => (
                <PatientCard
                  key={p.id}
                  patient={p}
                  onSchedule={() => handleSchedule(p.id)}
                  onUnschedule={() => handleUnschedule(p.id)}
                  onEdit={setEditingPatient}
                  onDelete={handleDeletePatient}
                  compact={true}
                  isOnPlan={displayPatients.some(dp => dp.id === p.id)}
                />
              ))}
            </div>

            {/* Edit Modal */}
            {editingPatient && (
              <EditPatientModal
                patient={editingPatient}
                onClose={() => { setEditingPatient(null); }}
                onSave={handleUpdatePatient}
              />
            )}

          </section>
        )}
        {
          view === 'settings' && (
            <section>
              <h2 style={{ marginBottom: '1rem' }}>Einstellungen</h2>
              <div className="card">
                <h3 style={{ marginBottom: '1rem' }}>Praxisstandort</h3>
                <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
                  Dieser Standort (Start/Ziel) ist aktuell: <b>{praxisAddress}</b>
                </p>
                <form onSubmit={handleLocationUpdate}>
                  <div style={{ display: 'grid', gap: '1rem' }}>
                    <div>
                      <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Stadt</label>
                      <input name="city" className="input" placeholder="z.B. Würzburg" />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Straße & Hausnummer</label>
                      <input name="address" className="input" placeholder="z.B. Marktplatz 1" />
                    </div>
                    <button className="btn">Standort Speichern</button>
                  </div>
                </form>
              </div>
            </section>
          )
        }
      </main >
    </div >
  );
}

function EditPatientModal({ patient, onClose, onSave }) {
  const handleSubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      name: fd.get('name'),
      address: fd.get('address'),
      interval_days: parseInt(fd.get('interval')),
      visit_duration_minutes: parseInt(fd.get('duration'))
    };
    await onSave(patient.id, data);
    onClose();
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
      <div className="card" style={{ width: '100%', maxWidth: '500px', backgroundColor: 'white' }}>
        <h3>Patient bearbeiten</h3>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
          <input name="name" className="input" defaultValue={patient.name} placeholder="Name" required />
          <input name="address" className="input" defaultValue={patient.address} placeholder="Adresse" required />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="label">Intervall (Tage)</label>
              <input name="interval" type="number" className="input" defaultValue={patient.interval_days} />
            </div>
            <div>
              <label className="label">Dauer (Min)</label>
              <input name="duration" type="number" className="input" defaultValue={patient.visit_duration_minutes} />
            </div>
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

function PatientCard({ patient, idx, onVisit, onSchedule, onUnschedule, onEdit, onDelete, isDue, compact, dashboardCompact, isOnPlan }) {
  const lastVisit = new Date(patient.last_visit).toLocaleDateString();
  const nextVisit = new Date(new Date(patient.last_visit).getTime() + patient.interval_days * 86400000);
  const daysUntil = Math.ceil((nextVisit - new Date()) / (1000 * 60 * 60 * 24));

  let statusColor = 'badge-green';
  let statusText = 'OK';

  // Check if manually planned for today (naive check)
  const isManuallyPlanned = patient.planned_visit_date &&
    new Date(patient.planned_visit_date).toDateString() === new Date().toDateString();

  if (isManuallyPlanned) {
    statusColor = 'badge-yellow';
    statusText = 'Heute (Manuell)';
  } else if (daysUntil < 0) {
    statusColor = 'badge-red';
    statusText = `Überfällig (${Math.abs(daysUntil)} Tage)`;
  } else if (daysUntil === 0) {
    statusColor = 'badge-yellow';
    statusText = 'Heute fällig';
  } else {
    statusText = `in ${daysUntil} Tagen`;
  }

  // Compact View for "All Patients" list
  if (compact) {
    return (
      <div className="card" style={{ padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 'bold' }}>{patient.name}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{patient.address}</div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span className={`badge ${statusColor}`} style={{ fontSize: '0.75rem' }}>{statusText}</span>

          {/* Schedule / Unschedule Actions */}
          {isOnPlan ? (
            <button onClick={onUnschedule} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} title="Vom Tagesplan entfernen">❌</button>
          ) : (
            <button onClick={onSchedule} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} title="Auf Tagesplan setzen">📅</button>
          )}

          <button onClick={() => onEdit(patient)} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} title="Bearbeiten">✏️</button>
          <button onClick={() => onDelete(patient.id)} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', color: '#dc2626' }} title="Löschen">🗑️</button>
        </div>
      </div>
    );
  }

  // Dashboard Compact View (Streamlined)
  if (dashboardCompact) {
    return (
      <div className="card" style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{idx}. {patient.name}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{patient.address}</div>
          </div>
          {/* Action */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={onVisit} className="btn" style={{ padding: '0.25rem 0.75rem', fontSize: '0.9rem' }}>✅ Erledigt</button>
            {onUnschedule && <button onClick={onUnschedule} className="btn btn-secondary" style={{ padding: '0.25rem 0.75rem' }} title="Verschieben">❌</button>}
          </div>
        </div>
        {/* Info Line */}
        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'flex', gap: '1rem' }}>
          <span>⏱️ {patient.visit_duration_minutes} min Behandlungsdauer</span>
          {isManuallyPlanned && <span style={{ color: '#d97706' }}>⚠️ Manuell eingeplant</span>}
        </div>
      </div>
    );
  }

  // Fallback / Detailed View (Large)
  return (
    <div className="card" style={{ position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem' }}>{idx ? `${idx}. ` : ''}{patient.name}</h3>
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
          <div>{patient.interval_days} Tage</div>
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
        /* Only show scheduling button if not already manually planned for today to avoid confusion */
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
