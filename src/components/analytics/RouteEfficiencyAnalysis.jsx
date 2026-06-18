import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Clock, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';

const statusConfig = {
  on_time: { label: 'On Time', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  delayed: { label: 'Delayed', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  critical: { label: 'Critical Delay', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
};

export default function RouteEfficiencyAnalysis() {
  const [view, setView] = useState('chart');

  const { data, isLoading, error } = useQuery({
    queryKey: ['route-efficiency'],
    queryFn: async () => {
      const res = await base44.functions.invoke('analyseRouteEfficiency', {});
      return res.data;
    },
  });

  const routes = data?.routes || [];
  const avgDelay = data?.avgDelayPct || 0;

  const chartData = routes.slice(0, 12).map(r => ({
    name: r.route_name?.length > 12 ? r.route_name.slice(0, 12) + '…' : r.route_name,
    planned: r.planned_mins,
    actual: r.actual_mins,
    delay: r.delay_pct,
  }));

  if (isLoading) return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}
    </div>
  );

  if (error) return (
    <Card className="border-border/60">
      <CardContent className="py-12 text-center text-muted-foreground text-sm">
        Failed to load route efficiency data.
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      {/* KPI Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border/60"><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Routes Analysed</p>
          <p className="text-2xl font-bold font-jakarta mt-1">{routes.length}</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Avg Delay</p>
          <p className={`text-2xl font-bold font-jakarta mt-1 ${avgDelay > 10 ? 'text-red-500' : 'text-primary'}`}>{avgDelay}%</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">On Time</p>
          <p className="text-2xl font-bold font-jakarta text-green-600 mt-1">{routes.filter(r => r.status === 'on_time').length}</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Critical Delays</p>
          <p className="text-2xl font-bold font-jakarta text-red-500 mt-1">{routes.filter(r => r.status === 'critical').length}</p>
        </CardContent></Card>
      </div>

      {routes.length === 0 ? (
        <Card className="border-dashed border-border/60">
          <CardContent className="py-16 text-center text-muted-foreground">
            <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No completed routes with duration data yet</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Chart */}
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold font-jakarta">Planned vs Actual Duration (minutes)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v, n) => [`${v} mins`, n === 'planned' ? 'Planned' : 'Actual']} />
                  <Bar dataKey="planned" name="planned" fill="hsl(210,70%,65%)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="actual" name="actual" fill="hsl(0,84%,60%)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Table */}
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold font-jakarta">Route Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="text-left text-xs text-muted-foreground pb-2">Route</th>
                    <th className="text-left text-xs text-muted-foreground pb-2">Date</th>
                    <th className="text-right text-xs text-muted-foreground pb-2">Planned</th>
                    <th className="text-right text-xs text-muted-foreground pb-2">Actual</th>
                    <th className="text-right text-xs text-muted-foreground pb-2">Delay</th>
                    <th className="text-left text-xs text-muted-foreground pb-2 pl-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {routes.map(r => {
                    const cfg = statusConfig[r.status];
                    return (
                      <tr key={r.id}>
                        <td className="py-2 text-xs font-medium">{r.route_name}</td>
                        <td className="py-2 text-xs text-muted-foreground">{r.route_date || '—'}</td>
                        <td className="py-2 text-xs text-right">{r.planned_mins}m</td>
                        <td className="py-2 text-xs text-right">{r.actual_mins}m</td>
                        <td className={`py-2 text-xs text-right font-semibold ${r.delay_pct > 0 ? 'text-red-500' : 'text-green-600'}`}>
                          {r.delay_pct > 0 ? '+' : ''}{r.delay_pct}%
                        </td>
                        <td className="py-2 pl-3">
                          <Badge className={`text-xs ${cfg.color}`} variant="secondary">{cfg.label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}