import { useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { classifyFill, predictDaysToFull } from '@/lib/capacityAnalytics';
import { Badge } from '@/components/ui/badge';

const KAMPALA_CENTER = [0.3476, 32.5825];

// Color per fill classification, aligned with analytics engine
const FILL_COLOR = {
  overflow:    { fill: '#ef4444', stroke: '#b91c1c', label: 'Overflow',  dot: 'bg-red-500' },
  full:        { fill: '#f97316', stroke: '#c2410c', label: 'Full',      dot: 'bg-orange-500' },
  filling:     { fill: '#eab308', stroke: '#a16207', label: 'Filling',   dot: 'bg-yellow-500' },
  ok:          { fill: '#22c55e', stroke: '#15803d', label: 'OK',        dot: 'bg-green-500' },
  unknown:     { fill: '#94a3b8', stroke: '#64748b', label: 'No signal', dot: 'bg-slate-400' },
};

// Maintenance urgency: containers that need attention
function isUrgent(c) {
  const fill = classifyFill(c.last_fill_pct);
  if (fill === 'overflow' || fill === 'full') return true;
  if (c.status === 'maintenance') return true;
  if (typeof c.last_battery_pct === 'number' && c.last_battery_pct < 15) return true;
  const days = predictDaysToFull(c.last_fill_pct, c.avg_daily_fill_rate_pct);
  if (days !== null && days <= 1) return true;
  return false;
}

function ContainerPopup({ c }) {
  const fill = classifyFill(c.last_fill_pct);
  const style = FILL_COLOR[fill];
  const days = predictDaysToFull(c.last_fill_pct, c.avg_daily_fill_rate_pct);
  const urgent = isUrgent(c);

  return (
    <div className="text-xs space-y-1 min-w-[160px]">
      <div className="font-bold text-sm">{c.label || c.qr_code || 'Unnamed'}</div>
      <div className="flex gap-1 flex-wrap">
        <span className={`px-1.5 py-0.5 rounded text-white text-[10px]`} style={{ background: style.fill }}>
          {style.label}
        </span>
        {c.asset_category === 'skip' && (
          <span className="px-1.5 py-0.5 rounded bg-blue-500 text-white text-[10px]">Skip</span>
        )}
        {urgent && (
          <span className="px-1.5 py-0.5 rounded bg-red-600 text-white text-[10px]">⚠ Urgent</span>
        )}
      </div>
      <div className="text-gray-600 space-y-0.5 pt-1">
        <div>Fill: <strong>{typeof c.last_fill_pct === 'number' ? `${Math.round(c.last_fill_pct)}%` : '—'}</strong></div>
        {c.asset_category === 'skip'
          ? <div>Weight: <strong>{typeof c.last_weight_kg === 'number' ? `${c.last_weight_kg} kg` : '—'}</strong></div>
          : <div>Battery: <strong>{typeof c.last_battery_pct === 'number' ? `${Math.round(c.last_battery_pct)}%` : '—'}</strong></div>
        }
        {days !== null && <div>Full in: <strong>~{days}d</strong></div>}
        {c.address && <div className="truncate max-w-[180px]">📍 {c.address}</div>}
        {c.waste_stream && <div className="capitalize">Stream: {c.waste_stream.replace(/_/g, ' ')}</div>}
      </div>
    </div>
  );
}

export default function SmartBinsMap({ containers = [] }) {
  // Only render containers that have coordinates
  const mapped = useMemo(() =>
    containers.filter(c => c.latitude && c.longitude),
    [containers]
  );

  const urgentCount = useMemo(() => mapped.filter(isUrgent).length, [mapped]);
  const noCoords = containers.length - mapped.length;

  // Determine map center: average of all asset coords, fall back to Kampala
  const center = useMemo(() => {
    if (!mapped.length) return KAMPALA_CENTER;
    const avgLat = mapped.reduce((s, c) => s + c.latitude, 0) / mapped.length;
    const avgLon = mapped.reduce((s, c) => s + c.longitude, 0) / mapped.length;
    return [avgLat, avgLon];
  }, [mapped]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          {Object.entries(FILL_COLOR).map(([key, val]) => (
            <span key={key} className="flex items-center gap-1">
              <span className={`w-2.5 h-2.5 rounded-full inline-block ${val.dot}`} />
              {val.label}
            </span>
          ))}
          <span className="flex items-center gap-1 ml-2 border-l pl-3">
            <span className="w-2.5 h-2.5 rounded-full inline-block bg-red-600 ring-2 ring-red-400" />
            Urgent (pulsing)
          </span>
        </div>
        {urgentCount > 0 && (
          <Badge className="bg-red-100 text-red-700 text-xs">{urgentCount} asset{urgentCount !== 1 ? 's' : ''} need urgent attention</Badge>
        )}
      </div>

      <div className="relative rounded-xl overflow-hidden border border-border/60" style={{ height: 420 }}>
        <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {mapped.map(c => {
            const fill = classifyFill(c.last_fill_pct);
            const { fill: fillColor, stroke } = FILL_COLOR[fill];
            const urgent = isUrgent(c);
            const radius = urgent ? 12 : 9;

            return (
              <CircleMarker
                key={c.id}
                center={[c.latitude, c.longitude]}
                radius={radius}
                pathOptions={{
                  color: urgent ? '#dc2626' : stroke,
                  fillColor,
                  fillOpacity: 0.85,
                  weight: urgent ? 3 : 2,
                }}
              >
                <Tooltip direction="top" offset={[0, -8]}>
                  <span className="text-xs font-medium">{c.label || c.qr_code || 'Asset'}</span>
                </Tooltip>
                <Popup maxWidth={220}>
                  <ContainerPopup c={c} />
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>

        {/* Asset count badge */}
        <div className="absolute top-3 right-3 z-[1000] bg-white/90 dark:bg-card/90 rounded-lg px-3 py-1.5 text-xs shadow border border-border/40 space-y-0.5">
          <div className="font-semibold text-foreground">{mapped.length} assets on map</div>
          {noCoords > 0 && <div className="text-muted-foreground">{noCoords} without GPS</div>}
        </div>
      </div>

      {mapped.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-4">
          No assets have GPS coordinates set. Add latitude/longitude to containers to see them on the map.
        </p>
      )}
    </div>
  );
}