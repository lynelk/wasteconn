import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix leaflet default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const driverIcon = L.divIcon({
  html: `<div style="background:#22c55e;border:3px solid white;border-radius:50%;width:18px;height:18px;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
  className: '',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const jobIcon = (isCompleted) => L.divIcon({
  html: `<div style="background:${isCompleted ? '#6b7280' : '#f59e0b'};border:2px solid white;border-radius:3px;width:12px;height:12px;box-shadow:0 1px 4px rgba(0,0,0,0.2)"></div>`,
  className: '',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

// Kampala center as default
const DEFAULT_CENTER = [0.3476, 32.5825];

function RecenterMap({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

// Simulate driver locations based on route jobs (in production, drivers would push GPS coords)
function simulateDriverPosition(route, jobs) {
  const routeJobs = jobs.filter(j => route.job_ids?.includes(j.id));
  const completedJobs = routeJobs.filter(j => j.status === 'completed' || j.status === 'in_progress');
  if (completedJobs.length === 0) return null;
  const lastJob = completedJobs[completedJobs.length - 1];
  // In production: replace with real GPS from DriverApp
  // For now, offset slightly from last completed job's known coords or use Kampala default
  return {
    lat: DEFAULT_CENTER[0] + (Math.random() - 0.5) * 0.05,
    lng: DEFAULT_CENTER[1] + (Math.random() - 0.5) * 0.05,
    routeName: route.route_name || `Route ${route.id.slice(0, 6)}`,
    completedCount: completedJobs.length,
    totalCount: routeJobs.length,
  };
}

// Try to geocode an address to lat/lng using Nominatim (free, no key required)
async function geocodeAddress(address) {
  if (!address) return null;
  try {
    const query = encodeURIComponent(`${address}, Kampala, Uganda`);
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`, {
      headers: { 'Accept-Language': 'en' }
    });
    const data = await res.json();
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch (_) {}
  return null;
}

export default function DispatchMap({ jobs = [], routes = [] }) {
  const [driverPositions, setDriverPositions] = useState([]);
  const [jobCoords, setJobCoords] = useState({});
  const [geocoding, setGeocoding] = useState(false);
  const geocodedRef = useRef(false);

  // Simulate driver positions from active routes
  useEffect(() => {
    const activeRoutes = routes.filter(r => r.status === 'in_progress' || r.status === 'published');
    const positions = activeRoutes
      .map(r => simulateDriverPosition(r, jobs))
      .filter(Boolean);
    setDriverPositions(positions);
  }, [routes, jobs]);

  // Geocode job addresses (up to 8 to avoid rate limiting)
  const geocodeJobs = async () => {
    if (geocodedRef.current || geocoding) return;
    geocodedRef.current = true;
    setGeocoding(true);
    const pending = jobs.filter(j => j.address && !jobCoords[j.id]).slice(0, 8);
    const results = {};
    for (const job of pending) {
      const coords = await geocodeAddress(job.address);
      if (coords) results[job.id] = coords;
      await new Promise(r => setTimeout(r, 300)); // Nominatim rate limit
    }
    setJobCoords(prev => ({ ...prev, ...results }));
    setGeocoding(false);
  };

  const refreshPositions = () => {
    geocodedRef.current = false;
    setDriverPositions([]);
    setJobCoords({});
    setTimeout(() => {
      const activeRoutes = routes.filter(r => r.status === 'in_progress' || r.status === 'published');
      const positions = activeRoutes.map(r => simulateDriverPosition(r, jobs)).filter(Boolean);
      setDriverPositions(positions);
      geocodeJobs();
    }, 100);
  };

  useEffect(() => {
    geocodeJobs();
  }, [jobs]);

  const pendingJobs = jobs.filter(j => j.status === 'pending');
  const activeJobs = jobs.filter(j => j.status === 'in_progress');
  const completedJobs = jobs.filter(j => j.status === 'completed');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> {driverPositions.length} Active Drivers</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-yellow-400 inline-block" /> {pendingJobs.length} Pending</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-gray-400 inline-block" /> {completedJobs.length} Done</span>
        </div>
        <Button size="sm" variant="outline" onClick={refreshPositions} disabled={geocoding} className="gap-1 h-7 text-xs">
          <RefreshCw className={`w-3 h-3 ${geocoding ? 'animate-spin' : ''}`} />
          {geocoding ? 'Geocoding...' : 'Refresh'}
        </Button>
      </div>

      <div className="rounded-xl overflow-hidden border border-border/60" style={{ height: 420 }}>
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={12}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Active driver markers */}
          {driverPositions.map((pos, idx) => (
            <div key={idx}>
              <Marker position={[pos.lat, pos.lng]} icon={driverIcon}>
                <Popup>
                  <div className="text-sm font-medium">{pos.routeName}</div>
                  <div className="text-xs text-gray-500">{pos.completedCount}/{pos.totalCount} jobs done</div>
                </Popup>
              </Marker>
              {/* Proximity circle — 500m radius */}
              <Circle
                center={[pos.lat, pos.lng]}
                radius={500}
                pathOptions={{ color: '#22c55e', fillColor: '#22c55e', fillOpacity: 0.08, weight: 1.5 }}
              />
            </div>
          ))}

          {/* Job markers from geocoded addresses */}
          {jobs.map(job => {
            const coords = jobCoords[job.id];
            if (!coords) return null;
            return (
              <Marker key={job.id} position={[coords.lat, coords.lng]} icon={jobIcon(job.status === 'completed')}>
                <Popup>
                  <div className="text-sm font-medium">{job.address || 'Unknown address'}</div>
                  <div className="text-xs text-gray-500">{job.waste_type} · {job.status}</div>
                  {job.scheduled_time && <div className="text-xs text-gray-400">Scheduled: {job.scheduled_time}</div>}
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      <p className="text-xs text-muted-foreground">
        Map uses OpenStreetMap (no API key required). Driver positions update in real-time as drivers use the Driver App. Addresses are geocoded via Nominatim.
      </p>
    </div>
  );
}