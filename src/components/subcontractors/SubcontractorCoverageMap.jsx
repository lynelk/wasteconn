import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin } from 'lucide-react';

const COLORS = ['#2d9e6b', '#f59e0b', '#3b82f6', '#8b5cf6', '#ef4444', '#06b6d4'];

export default function SubcontractorCoverageMap() {
  const { data: subcontractors = [] } = useQuery({
    queryKey: ['subcontractors'],
    queryFn: () => base44.entities.Subcontractor.filter({ status: 'active' }),
  });

  const { data: zones = [] } = useQuery({
    queryKey: ['service-zones'],
    queryFn: () => base44.entities.ServiceZone.list(),
  });

  const zoneMap = Object.fromEntries(zones.map(z => [z.id, z]));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Zone coverage assignments for active subcontractors.
      </p>

      {subcontractors.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No active subcontractors found.</p>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {subcontractors.map((s, idx) => {
          const color = COLORS[idx % COLORS.length];
          const coveredZones = (s.service_zones || []).map(zid => zoneMap[zid]).filter(Boolean);
          return (
            <Card key={s.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
                  {s.company_name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {coveredZones.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No zones assigned</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {coveredZones.map(z => (
                      <Badge key={z.id} variant="outline" className="text-xs gap-1">
                        <MapPin className="w-2.5 h-2.5" />
                        {z.zone_name}
                        {z.district ? ` · ${z.district}` : ''}
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">{coveredZones.length} zone(s) covered · {s.vehicle_count || 0} vehicles</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}