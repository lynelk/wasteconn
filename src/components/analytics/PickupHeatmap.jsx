import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin } from 'lucide-react';

// Group pickups by zone and compute intensity
function buildZoneData(pickups, zones) {
  const zoneCounts = {};
  for (const p of pickups) {
    const zid = p.zone_id || 'unknown';
    zoneCounts[zid] = (zoneCounts[zid] || 0) + 1;
  }

  const zoneMap = {};
  for (const z of zones) zoneMap[z.id] = z;

  const entries = Object.entries(zoneCounts).map(([zid, count]) => {
    const zone = zoneMap[zid];
    return {
      zone_id: zid,
      zone_name: zone?.zone_name || zone?.name || `Zone ${zid.slice(0, 6)}`,
      count,
      district: zone?.district || '—',
    };
  });

  entries.sort((a, b) => b.count - a.count);

  const max = entries[0]?.count || 1;
  return entries.map(e => ({ ...e, intensity: Math.round((e.count / max) * 100) }));
}

function IntensityBar({ value }) {
  const color =
    value >= 75 ? 'bg-red-500' :
    value >= 50 ? 'bg-orange-400' :
    value >= 25 ? 'bg-yellow-400' :
    'bg-green-400';
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-muted-foreground w-8 text-right">{value}%</span>
    </div>
  );
}

export default function PickupHeatmap() {
  const { data: pickups = [] } = useQuery({
    queryKey: ['pickups-heatmap'],
    queryFn: () => base44.entities.PickupRequest.list('-created_date', 500),
  });

  const { data: zones = [] } = useQuery({
    queryKey: ['service-zones'],
    queryFn: () => base44.entities.ServiceZone.list(),
  });

  const zoneData = useMemo(() => buildZoneData(pickups, zones), [pickups, zones]);

  const demandLabel = (v) =>
    v >= 75 ? { text: 'Very High', cls: 'bg-red-100 text-red-700' } :
    v >= 50 ? { text: 'High', cls: 'bg-orange-100 text-orange-700' } :
    v >= 25 ? { text: 'Medium', cls: 'bg-yellow-100 text-yellow-700' } :
    { text: 'Low', cls: 'bg-green-100 text-green-700' };

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-2 items-center text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Demand Level:</span>
        {[
          { label: 'Very High (≥75%)', cls: 'bg-red-500' },
          { label: 'High (≥50%)', cls: 'bg-orange-400' },
          { label: 'Medium (≥25%)', cls: 'bg-yellow-400' },
          { label: 'Low (<25%)', cls: 'bg-green-400' },
        ].map(l => (
          <span key={l.label} className="flex items-center gap-1">
            <span className={`w-2.5 h-2.5 rounded-full inline-block ${l.cls}`} />
            {l.label}
          </span>
        ))}
      </div>

      {zoneData.length === 0 ? (
        <Card className="border-dashed border-border/60">
          <CardContent className="py-16 text-center text-muted-foreground">
            <MapPin className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No pickup data with zone assignments yet</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold font-jakarta flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              Pickup Demand by Zone ({pickups.length} total requests)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {zoneData.map((z, i) => {
                const label = demandLabel(z.intensity);
                return (
                  <div key={z.zone_id} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-5 text-right font-medium">#{i + 1}</span>
                    <div className="min-w-[140px]">
                      <p className="text-sm font-medium truncate">{z.zone_name}</p>
                      <p className="text-xs text-muted-foreground">{z.district} · {z.count} requests</p>
                    </div>
                    <IntensityBar value={z.intensity} />
                    <Badge className={`text-xs shrink-0 ${label.cls}`} variant="secondary">{label.text}</Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top 3 highlight cards */}
      {zoneData.length >= 3 && (
        <div className="grid sm:grid-cols-3 gap-3">
          {zoneData.slice(0, 3).map((z, i) => {
            const medals = ['🥇', '🥈', '🥉'];
            return (
              <Card key={z.zone_id} className={`border-border/60 ${i === 0 ? 'border-l-4 border-l-red-400' : ''}`}>
                <CardContent className="pt-4 pb-3">
                  <p className="text-lg">{medals[i]}</p>
                  <p className="font-semibold text-sm mt-1 font-jakarta">{z.zone_name}</p>
                  <p className="text-2xl font-bold font-jakarta text-primary mt-1">{z.count}</p>
                  <p className="text-xs text-muted-foreground">pickup requests</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}