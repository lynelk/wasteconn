import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import { base44 } from '@/api/base44Client';
import { X, Navigation, Clock, Timer } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const driverIcon = L.divIcon({
  html: `<div style="background:#22c55e;border:3px solid white;border-radius:50%;width:22px;height:22px;box-shadow:0 2px 8px rgba(0,0,0,0.35)"></div>`,
  className: '',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const DEFAULT_CENTER = [0.3476, 32.5825];

export default function TrackDispatchModal({ pickup, onClose }) {
  const [driverLocation, setDriverLocation] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLocation = async () => {
      if (!pickup?.assigned_driver_id) { setLoading(false); return; }
      try {
        const locs = await base44.entities.DriverLocation.filter({ driver_id: pickup.assigned_driver_id, is_active: true });
        if (locs.length > 0) setDriverLocation(locs[0]);
      } catch (_) {}
      setLoading(false);
    };

    fetchLocation();

    // Real-time updates
    const unsub = base44.entities.DriverLocation.subscribe((event) => {
      if (event.data?.driver_id === pickup?.assigned_driver_id) {
        setDriverLocation(event.data);
      }
    });
    return () => unsub();
  }, [pickup?.assigned_driver_id]);

  const { data: eta } = useQuery({
    queryKey: ['pickup-eta', pickup?.id],
    queryFn: () => base44.functions.invoke('computeEta', { pickup_id: pickup.id }),
    enabled: !!pickup?.id && !!pickup?.assigned_driver_id,
    refetchInterval: 30000,
    select: (res) => res?.data || res,
  });

  const isRecent = driverLocation && new Date(driverLocation.timestamp) > new Date(Date.now() - 5 * 60 * 1000);
  const mapCenter = driverLocation
    ? [driverLocation.latitude, driverLocation.longitude]
    : DEFAULT_CENTER;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60">
      <div className="bg-card rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl border border-border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Navigation className="w-4 h-4 text-primary" />
            <p className="font-semibold text-sm font-jakarta">Track Driver</p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>

        <div className="p-4 space-y-3">
          <div className="text-xs text-muted-foreground">
            <span className="capitalize font-medium text-foreground">{pickup?.waste_type} waste</span> pickup · {pickup?.address || 'Your address'}
          </div>

          {loading ? (
            <div className="h-48 bg-muted animate-pulse rounded-xl" />
          ) : driverLocation ? (
            <>
              <div className="flex items-center gap-2 text-xs">
                <span className={`w-2 h-2 rounded-full ${isRecent ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
                <span className={isRecent ? 'text-green-600 font-medium' : 'text-yellow-600'}>
                  {isRecent ? 'Driver is nearby' : 'Location may be outdated'}
                </span>
                <span className="text-muted-foreground ml-auto flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDistanceToNow(new Date(driverLocation.timestamp), { addSuffix: true })}
                </span>
              </div>

              {eta?.available && (
                <div className="flex items-center justify-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-3 py-2">
                  <Timer className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-primary font-jakarta">
                    ~{eta.eta_minutes} min away
                  </span>
                  <span className="text-xs text-muted-foreground">· {eta.distance_km} km</span>
                  {eta.stale && <span className="text-[10px] text-yellow-600">(estimate)</span>}
                </div>
              )}

              <div className="rounded-xl overflow-hidden border border-border/60" style={{ height: 250 }}>
                <MapContainer center={mapCenter} zoom={14} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false} zoomControl={false}>
                  <TileLayer
                    attribution='&copy; OpenStreetMap contributors'
                    url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Marker position={mapCenter} icon={driverIcon}>
                    <Popup>
                      <div className="text-sm font-medium">{driverLocation.driver_name || 'Your driver'}</div>
                      {driverLocation.speed_kmh != null && <div className="text-xs text-gray-500">{driverLocation.speed_kmh.toFixed(1)} km/h</div>}
                    </Popup>
                  </Marker>
                  <Circle
                    center={mapCenter}
                    radius={driverLocation.accuracy_meters || 200}
                    pathOptions={{ color: '#22c55e', fillColor: '#22c55e', fillOpacity: 0.1, weight: 1 }}
                  />
                </MapContainer>
              </div>

              {driverLocation.speed_kmh != null && (
                <p className="text-xs text-center text-muted-foreground">
                  Driver moving at {driverLocation.speed_kmh.toFixed(1)} km/h
                </p>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Navigation className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>Driver location not yet available.</p>
              <p className="text-xs mt-1">The driver's app may not have GPS enabled yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}