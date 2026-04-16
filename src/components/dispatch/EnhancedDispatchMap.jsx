import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet';
import { RefreshCw, Layers, Truck, MapPin, Route } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { formatDistanceToNow } from 'date-fns';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const vehicleIcon = (isActive, speed) => L.divIcon({
  html: `<div style="background:${isActive ? (speed > 0 ? '#22c55e' : '#f59e0b') : '#9ca3af'};border:3px solid white;border-radius:50%;width:22px;height:22px;box-shadow:0 2px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;">
    <svg width="11" height="11" viewBox="0 0 24 24" fill="white"><path d="M5 3h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2zM3 17h18v2H3v-2z"/></svg>
  </div>`,
  className: '',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const driverIcon = (isRecent) => L.divIcon({
  html: `<div style="background:${isRecent ? '#6366f1' : '#9ca3af'};border:3px solid white;border-radius:50%;width:18px;height:18px;box-shadow:0 2px 8px rgba(0,0,0,0.3)">
  </div>`,
  className: '',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const jobIcon = (status) => {
  const colors = { pending: '#f59e0b', assigned: '#3b82f6', in_progress: '#8b5cf6', completed: '#6b7280' };
  const color = colors[status] || '#9ca3af';
  return L.divIcon({
    html: `<div style="background:${color};border:2px solid white;border-radius:3px;width:12px;height:12px;box-shadow:0 1px 4px rgba(0,0,0,0.2)"></div>`,
    className: '', iconSize: [12, 12], iconAnchor: [6, 6],
  });
};

const ROUTE_COLORS = ['#3b82f6','#22c55e','#f59e0b','#ec4899','#8b5cf6','#14b8a6'];
const DEFAULT_CENTER = [0.3476, 32.5825];

async function geocodeAddress(address) {
  if (!address) return null;
  try {
    const q = encodeURIComponent(`${address}, Kampala, Uganda`);
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`, {
      headers: { 'Accept-Language': 'en' }
    });
    const data = await res.json();
    if (data.length > 0) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {}
  return null;
}

function AutoFit({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) map.fitBounds(points, { padding: [30, 30] });
  }, [points.length]);
  return null;
}

export default function EnhancedDispatchMap({ jobs = [], routes = [] }) {
  const [driverLocations, setDriverLocations] = useState([]);
  const [vehicleTelematics, setVehicleTelematics] = useState([]);
  const [jobCoords, setJobCoords] = useState({});
  const [geocoding, setGeocoding] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [layers, setLayers] = useState({ drivers: true, vehicles: true, jobs: true, routes: true });
  const geocodedRef = useRef(false);

  const fetchLiveData = async () => {
    try {
      const [locs, telems] = await Promise.all([
        base44.entities.DriverLocation.filter({ is_active: true }),
        base44.entities.VehicleTelematics.filter({ is_active: true }),
      ]);
      const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      setDriverLocations(locs.filter(l => l.timestamp > cutoff));
      setVehicleTelematics(telems.filter(t => t.timestamp > cutoff));
      setLastRefresh(new Date());
    } catch {}
  };

  useEffect(() => {
    fetchLiveData();
    const unsub = base44.entities.DriverLocation.subscribe((event) => {
      if (event.type === 'create' || event.type === 'update') {
        setDriverLocations(prev => {
          const idx = prev.findIndex(l => l.id === event.id);
          if (idx >= 0) { const u = [...prev]; u[idx] = event.data; return u; }
          return [...prev, event.data];
        });
      } else if (event.type === 'delete') {
        setDriverLocations(prev => prev.filter(l => l.id !== event.id));
      }
    });
    const unsubT = base44.entities.VehicleTelematics.subscribe((event) => {
      if (event.type === 'create' || event.type === 'update') {
        setVehicleTelematics(prev => {
          const idx = prev.findIndex(l => l.id === event.id);
          if (idx >= 0) { const u = [...prev]; u[idx] = event.data; return u; }
          return [...prev, event.data];
        });
      }
    });
    return () => { unsub(); unsubT(); };
  }, []);

  useEffect(() => {
    if (geocodedRef.current || geocoding) return;
    geocodedRef.current = true;
    setGeocoding(true);
    const pending = jobs.filter(j => j.address && !jobCoords[j.id]).slice(0, 10);
    (async () => {
      const results = {};
      for (const job of pending) {
        const coords = await geocodeAddress(job.address);
        if (coords) results[job.id] = coords;
        await new Promise(r => setTimeout(r, 350));
      }
      setJobCoords(prev => ({ ...prev, ...results }));
      setGeocoding(false);
    })();
  }, [jobs.length]);

  // Parse route paths from GeoJSON
  const routePolylines = routes
    .filter(r => r.path_geojson && layers.routes)
    .map((r, i) => {
      try {
        const geo = JSON.parse(r.path_geojson);
        if (geo.type === 'LineString') {
          return { id: r.id, name: r.route_name, coords: geo.coordinates.map(c => [c[1], c[0]]), color: ROUTE_COLORS[i % ROUTE_COLORS.length] };
        }
        if (geo.type === 'Feature' && geo.geometry?.type === 'LineString') {
          return { id: r.id, name: r.route_name, coords: geo.geometry.coordinates.map(c => [c[1], c[0]]), color: ROUTE_COLORS[i % ROUTE_COLORS.length] };
        }
      } catch {}
      return null;
    }).filter(Boolean);

  const allPoints = [
    ...driverLocations.map(d => [d.latitude, d.longitude]),
    ...vehicleTelematics.map(v => [v.latitude, v.longitude]),
    ...Object.values(jobCoords).map(c => [c.lat, c.lng]),
  ];

  const toggleLayer = (key) => setLayers(l => ({ ...l, [key]: !l[key] }));

  return (
    <div className="space-y-3">
      {/* Legend + Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-indigo-500 inline-block" />{driverLocations.length} Drivers</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" />{vehicleTelematics.filter(v => v.speed_kmh > 0).length} Moving</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" />{vehicleTelematics.filter(v => v.ignition_on && v.speed_kmh === 0).length} Idle</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-yellow-400 inline-block" />{jobs.filter(j=>j.status==='pending').length} Pending Jobs</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Layer toggles */}
          {[
            { key: 'drivers', label: 'Drivers', icon: '👤' },
            { key: 'vehicles', label: 'Vehicles', icon: '🚛' },
            { key: 'jobs', label: 'Jobs', icon: '📍' },
            { key: 'routes', label: 'Routes', icon: '🛣' },
          ].map(l => (
            <button
              key={l.key}
              onClick={() => toggleLayer(l.key)}
              className={`text-xs px-2 py-1 rounded-md border transition-all ${
                layers[l.key] ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border text-muted-foreground'
              }`}
            >
              {l.icon} {l.label}
            </button>
          ))}
          <span className="text-xs text-muted-foreground">
            Updated {formatDistanceToNow(lastRefresh, { addSuffix: true })}
          </span>
          <Button size="sm" variant="outline" onClick={() => { fetchLiveData(); geocodedRef.current = false; }} disabled={geocoding} className="gap-1 h-7 text-xs">
            <RefreshCw className={`w-3 h-3 ${geocoding ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden border border-border/60" style={{ height: 480 }}>
        <MapContainer center={DEFAULT_CENTER} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <AutoFit points={allPoints} />

          {/* Route polylines */}
          {routePolylines.map(rp => (
            <Polyline key={rp.id} positions={rp.coords} pathOptions={{ color: rp.color, weight: 4, opacity: 0.75 }}>
              <Popup><div className="text-sm font-semibold">{rp.name}</div></Popup>
            </Polyline>
          ))}

          {/* Vehicle telematics markers */}
          {layers.vehicles && vehicleTelematics.map(veh => {
            const isRecent = new Date(veh.timestamp) > new Date(Date.now() - 5 * 60 * 1000);
            return (
              <Marker key={veh.id} position={[veh.latitude, veh.longitude]} icon={vehicleIcon(isRecent, veh.speed_kmh || 0)}>
                <Popup>
                  <div className="text-sm font-semibold">{veh.registration_number || 'Vehicle'}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {veh.speed_kmh > 0 ? `Moving · ${veh.speed_kmh.toFixed(1)} km/h` : veh.ignition_on ? 'Idling' : 'Engine off'}
                  </div>
                  {veh.fuel_level_pct != null && <div className="text-xs text-gray-400">Fuel: {veh.fuel_level_pct}%</div>}
                  {veh.engine_idle_seconds > 0 && <div className="text-xs text-yellow-600">Idle: {Math.round(veh.engine_idle_seconds / 60)} min</div>}
                  <div className="text-xs text-gray-400 mt-1">Updated {formatDistanceToNow(new Date(veh.timestamp), { addSuffix: true })}</div>
                </Popup>
              </Marker>
            );
          })}

          {/* Driver location markers */}
          {layers.drivers && driverLocations.map(loc => {
            const isRecent = new Date(loc.timestamp) > new Date(Date.now() - 5 * 60 * 1000);
            const route = routes.find(r => r.id === loc.route_id);
            return (
              <Marker key={loc.id} position={[loc.latitude, loc.longitude]} icon={driverIcon(isRecent)}>
                <Popup>
                  <div className="text-sm font-semibold">{loc.driver_name || 'Driver'}</div>
                  {route && <div className="text-xs text-gray-600">Route: {route.route_name}</div>}
                  {loc.speed_kmh != null && <div className="text-xs text-gray-500">Speed: {loc.speed_kmh.toFixed(1)} km/h</div>}
                  <div className="text-xs text-gray-400 mt-1">Updated {formatDistanceToNow(new Date(loc.timestamp), { addSuffix: true })}</div>
                  {!isRecent && <div className="text-xs text-yellow-600 mt-1">⚠ Location may be stale</div>}
                </Popup>
              </Marker>
            );
          })}

          {/* Job markers */}
          {layers.jobs && jobs.map(job => {
            const coords = jobCoords[job.id];
            if (!coords) return null;
            return (
              <Marker key={job.id} position={[coords.lat, coords.lng]} icon={jobIcon(job.status)}>
                <Popup>
                  <div className="text-sm font-medium">{job.address || 'Unknown address'}</div>
                  <div className="text-xs text-gray-500 capitalize">{job.waste_type} · {job.status?.replace('_', ' ')}</div>
                  {job.scheduled_time && <div className="text-xs text-gray-400">⏰ {job.scheduled_time}</div>}
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {driverLocations.length === 0 && vehicleTelematics.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-1">
          No active GPS signals. Enable location sharing on Field App or configure telematics in System Settings.
        </p>
      )}
    </div>
  );
}