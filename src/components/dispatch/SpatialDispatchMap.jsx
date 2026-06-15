import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Tooltip, useMap } from 'react-leaflet';
import { RefreshCw, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const STATUS_COLORS = {
  pending: '#f59e0b',
  assigned: '#3b82f6',
  in_progress: '#8b5cf6',
  completed: '#6b7280',
};

const ZONE_PALETTE = [
  '#3b82f6', '#22c55e', '#f59e0b', '#ec4899',
  '#8b5cf6', '#14b8a6', '#ef4444', '#f97316',
];

const DEFAULT_CENTER = [0.3476, 32.5825];

function makeJobIcon(status, isSelected) {
  const color = STATUS_COLORS[status] || '#9ca3af';
  const size = isSelected ? 16 : 12;
  const border = isSelected ? '3px solid #1d4ed8' : '2px solid white';
  return L.divIcon({
    html: `<div style="background:${color};border:${border};border-radius:50%;width:${size}px;height:${size}px;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
    className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2],
  });
}

async function geocodeAddress(address) {
  if (!address) return null;
  try {
    const q = encodeURIComponent(`${address}, Kampala, Uganda`);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    if (data.length > 0) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {}
  return null;
}

function AutoFit({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) {
      try { map.fitBounds(points, { padding: [30, 30] }); } catch {}
    }
  }, [points.length]);
  return null;
}

export default function SpatialDispatchMap({
  jobs = [],
  zones = [],
  selectedZone = 'all',
  onZoneClick,
  selectedJobs = [],
  onJobClick,
}) {
  const [jobCoords, setJobCoords] = useState({});
  const [geocoding, setGeocoding] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [showZones, setShowZones] = useState(true);
  const geocodedRef = useRef(false);
  const geocodedIds = useRef(new Set());

  // Geocode jobs that have addresses but no lat/lng stored
  useEffect(() => {
    const pending = jobs.filter(j => {
      if (j.latitude && j.longitude) return false; // already has coords
      return j.address && !geocodedIds.current.has(j.id);
    }).slice(0, 10);

    if (pending.length === 0 || geocoding) return;
    setGeocoding(true);

    (async () => {
      const results = {};
      for (const job of pending) {
        geocodedIds.current.add(job.id);
        const coords = await geocodeAddress(job.address);
        if (coords) results[job.id] = coords;
        await new Promise(r => setTimeout(r, 350));
      }
      setJobCoords(prev => ({ ...prev, ...results }));
      setGeocoding(false);
      setLastRefresh(new Date());
    })();
  }, [jobs.length]);

  // Build zone polygons from boundary_geojson if available, else skip rendering
  const zonePolygons = zones
    .map((zone, idx) => {
      let coords = null;
      if (zone.boundary_geojson) {
        try {
          const geo = JSON.parse(zone.boundary_geojson);
          const ring = geo.type === 'Polygon'
            ? geo.coordinates[0]
            : geo.type === 'Feature' && geo.geometry?.type === 'Polygon'
              ? geo.geometry.coordinates[0]
              : null;
          if (ring) coords = ring.map(c => [c[1], c[0]]);
        } catch {}
      }
      return { zone, coords, color: ZONE_PALETTE[idx % ZONE_PALETTE.length] };
    })
    .filter(z => z.coords);

  const getJobCoords = (job) => {
    if (job.latitude && job.longitude) return { lat: job.latitude, lng: job.longitude };
    return jobCoords[job.id] || null;
  };

  const visibleJobs = selectedZone === 'all' ? jobs : jobs.filter(j => j.zone_id === selectedZone);

  const allPoints = visibleJobs
    .map(getJobCoords)
    .filter(Boolean)
    .map(c => [c.lat, c.lng]);

  const selectedJobIds = new Set(selectedJobs.map(j => j.id));

  const statusCounts = {
    pending: jobs.filter(j => j.status === 'pending').length,
    assigned: jobs.filter(j => j.status === 'assigned').length,
    in_progress: jobs.filter(j => j.status === 'in_progress').length,
    completed: jobs.filter(j => j.status === 'completed').length,
  };

  return (
    <div className="space-y-3">
      {/* Controls row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <span key={status} className="flex items-center gap-1 text-muted-foreground">
              <span className="w-3 h-3 rounded-full inline-block border-2 border-white shadow-sm" style={{ background: color }} />
              {statusCounts[status] || 0} {status.replace('_', ' ')}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowZones(v => !v)}
            className={`text-xs px-2 py-1 rounded-md border transition-all gap-1 flex items-center ${showZones ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border text-muted-foreground'}`}
          >
            <Layers className="w-3 h-3" /> Zones
          </button>
          <span className="text-xs text-muted-foreground">
            {geocoding ? 'Geocoding...' : `Updated ${formatDistanceToNow(lastRefresh, { addSuffix: true })}`}
          </span>
          <Button
            size="sm" variant="outline"
            onClick={() => { geocodedIds.current = new Set(); setJobCoords({}); setGeocoding(false); }}
            disabled={geocoding}
            className="gap-1 h-7 text-xs"
          >
            <RefreshCw className={`w-3 h-3 ${geocoding ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Zone filter pills */}
      {zones.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => onZoneClick?.('all')}
            className={`text-xs px-2.5 py-1 rounded-full border transition-all ${selectedZone === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}
          >
            All Zones ({jobs.length})
          </button>
          {zones.map((zone, idx) => {
            const count = jobs.filter(j => j.zone_id === zone.id).length;
            const color = ZONE_PALETTE[idx % ZONE_PALETTE.length];
            return (
              <button
                key={zone.id}
                onClick={() => onZoneClick?.(zone.id)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-all ${selectedZone === zone.id ? 'text-white border-transparent' : 'border-border text-muted-foreground hover:border-primary/50'}`}
                style={selectedZone === zone.id ? { background: color, borderColor: color } : {}}
              >
                {zone.zone_name} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Map */}
      <div className="rounded-xl overflow-hidden border border-border/60" style={{ height: 480 }}>
        <MapContainer center={DEFAULT_CENTER} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <AutoFit points={allPoints} />

          {/* Zone boundary polygons */}
          {showZones && zonePolygons.map(({ zone, coords, color }) => {
            const isSelected = selectedZone === zone.id;
            return (
              <Polygon
                key={zone.id}
                positions={coords}
                eventHandlers={{ click: () => onZoneClick?.(isSelected ? 'all' : zone.id) }}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: isSelected ? 0.18 : 0.07,
                  weight: isSelected ? 3 : 1.5,
                  dashArray: isSelected ? undefined : '6 4',
                }}
              >
                <Tooltip sticky>
                  <span className="font-semibold">{zone.zone_name}</span>
                  <br />
                  <span className="text-xs text-gray-500">
                    {jobs.filter(j => j.zone_id === zone.id).length} jobs · click to filter
                  </span>
                </Tooltip>
              </Polygon>
            );
          })}

          {/* Job markers */}
          {visibleJobs.map(job => {
            const coords = getJobCoords(job);
            if (!coords) return null;
            const isSelected = selectedJobIds.has(job.id);
            return (
              <Marker
                key={job.id}
                position={[coords.lat, coords.lng]}
                icon={makeJobIcon(job.status, isSelected)}
                eventHandlers={{ click: () => onJobClick?.(job) }}
              >
                <Popup>
                  <div className="text-sm font-medium">{job.address || 'Unknown address'}</div>
                  <div className="text-xs text-gray-500 capitalize mt-0.5">{job.waste_type} · {job.status?.replace('_', ' ')}</div>
                  {job.scheduled_time && <div className="text-xs text-gray-400">⏰ {job.scheduled_time}</div>}
                  {job.estimated_weight_kg && <div className="text-xs text-gray-400">⚖ {job.estimated_weight_kg} kg est.</div>}
                  {onJobClick && job.status === 'pending' && !job.assigned_driver_id && (
                    <button
                      onClick={() => onJobClick(job)}
                      className="mt-1.5 text-xs text-blue-600 hover:underline"
                    >
                      {isSelected ? '✓ Selected for route' : '+ Select for route'}
                    </button>
                  )}
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {zonePolygons.length === 0 && zones.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Zone boundaries not configured. Add <code>boundary_geojson</code> to ServiceZone records to see zone overlays.
        </p>
      )}
    </div>
  );
}