import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

export default function YieldTrendChart({ facilityId }) {
  const { data: records = [], isLoading } = useQuery({
    queryKey: ['facility-yield', facilityId],
    queryFn: () => base44.entities.FacilityYieldRecord.filter({ facility_id: facilityId }, 'period', 30),
    enabled: !!facilityId,
  });

  const chartData = records.map(r => ({
    period: r.period?.slice(5), // MM-DD
    Inbound: parseFloat((r.inbound_t || 0).toFixed(2)),
    Recyclable: parseFloat((r.sorted_recyclable_t || 0).toFixed(2)),
    Organic: parseFloat((r.sorted_organic_t || 0).toFixed(2)),
    Residue: parseFloat((r.sorted_residue_t || 0).toFixed(2)),
    'Diversion %': parseFloat((r.diversion_rate_pct || 0).toFixed(1)),
  }));

  if (isLoading) return <div className="text-center py-16 text-muted-foreground text-sm">Loading…</div>;
  if (records.length === 0) return <div className="text-center py-16 text-muted-foreground text-sm">No yield records yet. Add daily entries to see trends.</div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Waste Fractions by Day (tonnes)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gInbound" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gRecyclable" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gOrganic" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gResidue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="t" />
              <Tooltip formatter={(v) => `${v}t`} />
              <Legend />
              <Area type="monotone" dataKey="Inbound" stroke="hsl(var(--chart-3))" fill="url(#gInbound)" strokeWidth={2} />
              <Area type="monotone" dataKey="Recyclable" stroke="hsl(var(--primary))" fill="url(#gRecyclable)" strokeWidth={2} />
              <Area type="monotone" dataKey="Organic" stroke="hsl(var(--accent))" fill="url(#gOrganic)" strokeWidth={2} />
              <Area type="monotone" dataKey="Residue" stroke="hsl(var(--destructive))" fill="url(#gResidue)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Diversion Rate % by Day</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gDiv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" />
              <Tooltip formatter={v => `${v}%`} />
              <Area type="monotone" dataKey="Diversion %" stroke="hsl(var(--primary))" fill="url(#gDiv)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}