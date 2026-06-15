import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

// Fix default Leaflet icon paths (Vite issue)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom marker icons
const makeIcon = (color, symbol) => L.divIcon({
  className: '',
  html: `<div style="background:${color};border:2px solid white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${symbol}</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const iconPickup = makeIcon('#f59e0b', '📦');
const iconVehicle = makeIcon('#3b82f6', '🚛');
const iconCompleted = makeIcon('#22c55e', '✅');
const iconPending = makeIcon('#f97316', '⏳');

const KAMPALA_CENTER = [0.3476, 32.5825];

// Simple geocoding cache using address string
const geocodeCache = {};
async function geocode(address) {
  if (!address) return null;
  if (geocodeCache[address]) return geocodeCache[address];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address + ', Kampala, Uganda')}&format=json&limit=1`,
      { headers: { 'User-Agent': 'NLSWMS/1.0' } }
    );
    const data = await res.json();
    if (data[0]) {
      const coords = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
      geocodeCache[address] = coords;
      return coords;
    }
  } catch (_) {}
  return null;
}

// Satisfaction rating → heatmap color
function satisfactionColor(rating) {
  if (rating >= 4.5) return '#22c55e';
  if (rating >= 3.5) return '#86efac';
  if (rating >= 2.5) return '#f59e0b';
  if (rating >= 1.5) return '#f97316';
  return '#ef4444';
}

export default function DashboardMap({ servicePoints = [], pickups = [], vehicles = [], routes = [] }) {
  const [spCoords, setSpCoords] = useState([]);
  const [pickupCoords, setPickupCoords] = useState([]);

  const { data: surveys = [] } = useQuery({
    queryKey: ['satisfaction-heatmap'],
    queryFn: () => base44.entities.CustomerSatisfaction.list('-created_date', 300),
    staleTime: 5 * 60 * 1000,
  });

  const { data: zones = [] } = useQuery({
    queryKey: ['zones-heatmap'],
    queryFn: () => base44.entities.ServiceZone.list(),
    staleTime: 10 * 60 * 1000,
  });

  // Build per-zone avg rating for zones that have lat/lon
  const zoneSatisfaction = (() => {
    const byZone = {};
    surveys.filter(s => s.rating != null && s.zone_id).forEach(s => {
      if (!byZone[s.zone_id]) byZone[s.zone_id] = { total: 0, count: 0 };
      byZone[s.zone_id].total += s.rating;
      byZone[s.zone_id].count += 1;
    });
    return zones
      .filter(z => z.latitude && z.longitude && byZone[z.id])
      .map(z => ({
        id: z.id,
        name: z.zone_name || z.name,
        lat: z.latitude,
        lon: z.longitude,
        avg: byZone[z.id].total / byZone[z.id].count,
        count: byZone[z.id].count,
      }));
  })();

  useEffect(() => {
    // Geocode service points that have explicit lat/lon
    const mapped = servicePoints
      .filter(sp => sp.latitude && sp.longitude)
      .map(sp => ({ ...sp, coords: [sp.latitude, sp.longitude] }));
    setSpCoords(mapped);
  }, [servicePoints]);

  useEffect(() => {
    // Geocode pickup addresses (limit to 15 to avoid rate limiting)
    const toGeocode = pickups
      .filter(p => p.address && p.status !== 'cancelled')
      .slice(0, 15);

    let cancelled = false;
    const run = async () => {
      const results = [];
      for (const p of toGeocode) {
        if (cancelled) break;
        const coords = await geocode(p.address);
        if (coords) results.push({ ...p, coords });
        await new Promise(r => setTimeout(r, 200)); // rate limit
      }
      if (!cancelled) setPickupCoords(results);
    };
    run();
    return () => { cancelled = true; };
  }, [pickups]);

  // Simulate vehicle positions near Kampala if no explicit coordinates
  const vehiclePositions = vehicles.slice(0, 8).map((v, i) => {
    const angle = (i / 8) * 2 * Math.PI;
    const radius = 0.04 + (i % 3) * 0.015;
    return {
      ...v,
      coords: [KAMPALA_CENTER[0] + Math.sin(angle) * radius, KAMPALA_CENTER[1] + Math.cos(angle) * radius],
    };
  });

  return (
    <div className="relative rounded-xl overflow-hidden border border-border/60" style={{ height: 380 }}>
      <MapContainer center={KAMPALA_CENTER} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Service Points */}
        {spCoords.map(sp => (
          <CircleMarker key={sp.id} center={sp.coords} radius={8} color="#8b5cf6" fillColor="#8b5cf6" fillOpacity={0.7} weight={2}>
            <Popup>
              <div className="text-xs">
                <strong>📍 Service Point</strong><br />
                {sp.name || sp.address}<br />
                {sp.status && <span className="capitalize">{sp.status}</span>}
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* Pickup Requests */}
        {pickupCoords.map(p => (
          <Marker
            key={p.id}
            position={p.coords}
            icon={p.status === 'completed' ? iconCompleted : p.status === 'in_progress' ? iconVehicle : iconPending}
          >
            <Popup>
              <div className="text-xs">
                <strong>📦 {p.waste_type?.replace(/_/g, ' ')} Pickup</strong><br />
                {p.address}<br />
                Status: <span className="capitalize font-semibold">{p.status?.replace(/_/g, ' ')}</span>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Satisfaction Heatmap Overlays */}
        {zoneSatisfaction.map(z => (
          <CircleMarker
            key={`sat-${z.id}`}
            center={[z.lat, z.lon]}
            radius={22}
            color={satisfactionColor(z.avg)}
            fillColor={satisfactionColor(z.avg)}
            fillOpacity={0.35}
            weight={2}
          >
            <Tooltip permanent={false} direction="top">
              <div className="text-xs">
                <strong>{z.name}</strong><br />
                Avg Rating: {z.avg.toFixed(1)} ⭐ ({z.count} responses)
              </div>
            </Tooltip>
          </CircleMarker>
        ))}

        {/* Vehicles */}
        {vehiclePositions.map(v => (
          <Marker key={v.id} position={v.coords} icon={iconVehicle}>
            <Popup>
              <div className="text-xs">
                <strong>🚛 {v.registration_number}</strong><br />
                {v.vehicle_type} · {v.make_model || '—'}<br />
                Status: <span className="capitalize font-semibold">{v.status?.replace(/_/g, ' ')}</span>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 bg-white/90 dark:bg-card/90 rounded-lg px-3 py-2 text-xs space-y-1 shadow border border-border/40 z-[1000]">
        <div className="flex items-center gap-1.5"><span>📦</span> Pickup Jobs</div>
        <div className="flex items-center gap-1.5"><span>🚛</span> Vehicles</div>
        <div className="flex items-center gap-1.5"><span style={{width:10,height:10,borderRadius:'50%',background:'#8b5cf6',display:'inline-block'}}></span> Service Points</div>
        <div className="flex items-center gap-1.5"><span>✅</span> Completed</div>
        {zoneSatisfaction.length > 0 && (
          <div className="mt-1.5 pt-1.5 border-t border-border/30">
            <p className="text-[10px] font-semibold text-muted-foreground mb-1">Satisfaction</p>
            <div className="flex items-center gap-1"><span style={{width:10,height:10,borderRadius:'50%',background:'#22c55e',display:'inline-block'}}></span><span>≥4.5</span></div>
            <div className="flex items-center gap-1"><span style={{width:10,height:10,borderRadius:'50%',background:'#f59e0b',display:'inline-block'}}></span><span>2.5–3.5</span></div>
            <div className="flex items-center gap-1"><span style={{width:10,height:10,borderRadius:'50%',background:'#ef4444',display:'inline-block'}}></span><span>&lt;1.5</span></div>
          </div>
        )}
      </div>
    </div>
  );
}