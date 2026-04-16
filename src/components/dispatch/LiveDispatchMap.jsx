import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

const driverIcon = (isActive) => L.divIcon({
  html: `<div style="background:${isActive ? '#22c55e' : '#9ca3af'};border:3px solid white;border-radius:50%;width:20px;height:20px;box-shadow:0 2px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;">
    <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M5 3h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2zM3 17h18v2H3v-2z"/></svg>
  </div>`,
  className: '',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const jobIcon = (status) => {
  const colors = { pending: '#f59e0b', assigned: '#3b82f6', in_progress: '#8b5cf6', completed: '#6b7280' };
  const color = colors[status] || '#9ca3af';
  return L.divIcon({
    html: `<div style="background:${color};border:2px solid white;border-radius:3px;width:12px;height:12px;box-shadow:0 1px 4px rgba(0,0,0,0.2)"></div>`,
    className: '',
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
};

const DEFAULT_CENTER = [0.3476, 32.5825];

async function geocodeAddress(address) {
  if (!address) return null;
  try {
    const query = encodeURIComponent(`${address}, Kampala, Uganda`);
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`, {
      headers: { 'Accept-Language': 'en' }
    });
    const data = await res.json();
    if (data.length > 0) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch (_) {}
  return null;
}

function AutoFitBounds({ drivers, jobCoords }) {
  const map = useMap();
  useEffect(() => {
    const points = [
      ...drivers.map(d => [d.latitude, d.longitude]),
      ...Object.values(jobCoords).map(c => [c.lat, c.lng]),
    ];
    if (points.length > 1) {
      map.fitBounds(points, { padding: [30, 30] });
    }
  }, [drivers.length, Object.keys(jobCoords).length]);
  return null;
}

export default function LiveDispatchMap({ jobs = [], routes = [] }) {
  const [driverLocations, setDriverLocations] = useState([]);
  const [jobCoords, setJobCoords] = useState({});
  const [geocoding, setGeocoding] = useState(false);
  const geocodedRef = useRef(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchDriverLocations = async () => {
    try {
      const locs = await base44.entities.DriverLocation.filter({ is_active: true });
      // Only show drivers updated in last 30 minutes
      const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      setDriverLocations(locs.filter(l => l.timestamp > cutoff));
      setLastRefresh(new Date());
    } catch (_) {}
  };

  useEffect(() => {
    fetchDriverLocations();
    // Real-time subscription
    const unsub = base44.entities.DriverLocation.subscribe((event) => {
      if (event.type === 'create' || event.type === 'update') {
        setDriverLocations(prev => {
          const idx = prev.findIndex(l => l.id === event.id);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = event.data;
            return updated;
          }
          return [...prev, event.data];
        });
      } else if (event.type === 'delete') {
        setDriverLocations(prev => prev.filter(l => l.id !== event.id));
      }
    });
    return () => unsub();
  }, []);

  const geocodeJobs = async () => {
    if (geocodedRef.current || geocoding) return;
    geocodedRef.current = true;
    setGeocoding(true);
    const pending = jobs.filter(j => j.address && !jobCoords[j.id]).slice(0, 10);
    const results = {};
    for (const job of pending) {
      const coords = await geocodeAddress(job.address);
      if (coords) results[job.id] = coords;
      await new Promise(r => setTimeout(r, 350));
    }
    setJobCoords(prev => ({ ...prev, ...results }));
    setGeocoding(false);
  };

  useEffect(() => {
    geocodedRef.current = false;
    geocodeJobs();
  }, [jobs.length]);

  const handleRefresh = () => {
    fetchDriverLocations();
    geocodedRef.current = false;
    setJobCoords({});
    geocodeJobs();
  };

  const pendingJobs = jobs.filter(j => j.status === 'pending');
  const inProgressJobs = jobs.filter(j => j.status === 'in_progress');
  const completedJobs = jobs.filter(j => j.status === 'completed');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" />{driverLocations.length} Live Drivers</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-yellow-400 inline-block" />{pendingJobs.length} Pending</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-purple-500 inline-block" />{inProgressJobs.length} In Progress</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-gray-400 inline-block" />{completedJobs.length} Done</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Updated {formatDistanceToNow(lastRefresh, { addSuffix: true })}
          </span>
          <Button size="sm" variant="outline" onClick={handleRefresh} disabled={geocoding} className="gap-1 h-7 text-xs">
            <RefreshCw className={`w-3 h-3 ${geocoding ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden border border-border/60" style={{ height: 440 }}>
        <MapContainer center={DEFAULT_CENTER} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <AutoFitBounds drivers={driverLocations} jobCoords={jobCoords} />

          {/* Live driver markers */}
          {driverLocations.map((loc) => {
            const isRecent = new Date(loc.timestamp) > new Date(Date.now() - 5 * 60 * 1000);
            const route = routes.find(r => r.id === loc.route_id);
            return (
              <div key={loc.id}>
                <Marker position={[loc.latitude, loc.longitude]} icon={driverIcon(isRecent)}>
                  <Popup>
                    <div className="text-sm font-semibold">{loc.driver_name || 'Driver'}</div>
                    {route && <div className="text-xs text-gray-600">Route: {route.route_name}</div>}
                    {loc.speed_kmh != null && <div className="text-xs text-gray-500">Speed: {loc.speed_kmh.toFixed(1)} km/h</div>}
                    <div className="text-xs text-gray-400 mt-1">
                      Updated {formatDistanceToNow(new Date(loc.timestamp), { addSuffix: true })}
                    </div>
                    {!isRecent && <div className="text-xs text-yellow-600 mt-1">⚠ Location may be stale</div>}
                  </Popup>
                </Marker>
                <Circle
                  center={[loc.latitude, loc.longitude]}
                  radius={loc.accuracy_meters || 300}
                  pathOptions={{ color: isRecent ? '#22c55e' : '#9ca3af', fillColor: isRecent ? '#22c55e' : '#9ca3af', fillOpacity: 0.08, weight: 1 }}
                />
              </div>
            );
          })}

          {/* Job markers */}
          {jobs.map(job => {
            const coords = jobCoords[job.id];
            if (!coords) return null;
            return (
              <Marker key={job.id} position={[coords.lat, coords.lng]} icon={jobIcon(job.status)}>
                <Popup>
                  <div className="text-sm font-medium">{job.address || 'Unknown address'}</div>
                  <div className="text-xs text-gray-500 capitalize">{job.waste_type} · {job.status?.replace('_', ' ')}</div>
                  {job.scheduled_time && <div className="text-xs text-gray-400">Scheduled: {job.scheduled_time}</div>}
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {driverLocations.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-1">
          No active driver GPS signals. Drivers must be using the Driver App with location sharing enabled.
        </p>
      )}
    </div>
  );
}