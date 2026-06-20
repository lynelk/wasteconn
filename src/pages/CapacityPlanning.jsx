import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Truck, AlertTriangle, CheckCircle, TrendingUp, Zap, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  ok: { label: 'OK', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  tight: { label: 'Tight', color: 'bg-amber-100 text-amber-800', icon: AlertTriangle },
  over: { label: 'Over Capacity', color: 'bg-red-100 text-red-800', icon: AlertTriangle }
};

const BAR_COLORS = { ok: '#22c55e', tight: '#f59e0b', over: '#ef4444' };

export default function CapacityPlanning() {
  const { user } = useAuth();
  const [runningPlan, setRunningPlan] = useState(false);
  const [simVehicleDelta, setSimVehicleDelta] = useState(0);

  const { data: plans = [], isLoading, refetch } = useQuery({
    queryKey: ['capacity-plans'],
    queryFn: () => base44.entities.CapacityPlan.list('-plan_date', 50),
  });

  const { data: zones = [] } = useQuery({
    queryKey: ['zones'],
    queryFn: () => base44.entities.ServiceZone.list(),
  });

  const zoneMap = Object.fromEntries(zones.map(z => [z.id, z]));

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const tomorrowPlans = plans.filter(p => p.plan_date === tomorrowStr);

  const handleRunPlan = async () => {
    setRunningPlan(true);
    try {
      await base44.functions.invoke('computeCapacityPlan', {});
      await refetch();
      toast.success('Capacity plan computed for tomorrow');
    } catch (e) {
      toast.error('Failed to run capacity plan');
    } finally {
      setRunningPlan(false);
    }
  };

  // What-If simulation
  const simPlans = tomorrowPlans.map(p => {
    const extraCapacity = simVehicleDelta * 3 * 0.9; // ~3t per extra truck × 90% efficiency
    const newCapacity = Math.max(0, (p.planned_capacity_t || 0) + extraCapacity);
    const newUtil = newCapacity > 0 ? Math.round(((p.forecast_demand_t || 0) / newCapacity) * 100) : 0;
    return {
      ...p,
      sim_capacity_t: newCapacity,
      sim_utilisation_pct: newUtil,
      sim_status: newUtil > 100 ? 'over' : newUtil > 80 ? 'tight' : 'ok'
    };
  });

  const chartData = simPlans.map(p => ({
    zone: zoneMap[p.zone_id]?.name || p.zone_id?.slice(0, 8) || 'Zone',
    utilisation: p.sim_utilisation_pct || p.utilisation_pct || 0,
    status: p.sim_status || p.status || 'ok'
  }));

  const overCount = tomorrowPlans.filter(p => p.status === 'over').length;
  const tightCount = tomorrowPlans.filter(p => p.status === 'tight').length;

  if (!['admin', 'super_admin'].includes(user?.role)) {
    return <div className="p-8 text-center text-muted-foreground">Access restricted to administrators.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-jakarta">Capacity & Load Planning</h1>
          <p className="text-muted-foreground text-sm mt-1">Tomorrow's 7-day demand forecast vs fleet availability</p>
        </div>
        <Button onClick={handleRunPlan} disabled={runningPlan}>
          {runningPlan ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
          Compute Plan
        </Button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{tomorrowPlans.filter(p => p.status === 'ok').length}</p>
              <p className="text-xs text-muted-foreground">Zones OK</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{tightCount}</p>
              <p className="text-xs text-muted-foreground">Zones Tight</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <Truck className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{overCount}</p>
              <p className="text-xs text-muted-foreground">Over Capacity</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* What-If Simulator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            What-If Simulator
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <label className="text-sm font-medium">Adjust vehicle count by:</label>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setSimVehicleDelta(v => v - 1)}>−</Button>
              <span className="w-8 text-center font-bold">{simVehicleDelta >= 0 ? `+${simVehicleDelta}` : simVehicleDelta}</span>
              <Button variant="outline" size="sm" onClick={() => setSimVehicleDelta(v => v + 1)}>+</Button>
            </div>
            {simVehicleDelta !== 0 && (
              <Button variant="ghost" size="sm" onClick={() => setSimVehicleDelta(0)}>Reset</Button>
            )}
          </div>
          {isLoading ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground">Loading plans...</div>
          ) : chartData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground">
              No plans yet — click "Compute Plan" to generate tomorrow's forecast.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="zone" tick={{ fontSize: 11 }} />
                <YAxis unit="%" domain={[0, 120]} />
                <Tooltip formatter={(v) => [`${v}%`, 'Utilisation']} />
                <Bar dataKey="utilisation" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={BAR_COLORS[entry.status] || '#6b7280'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Plan Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tomorrow's Zone Plans</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {tomorrowPlans.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No plans computed yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Zone</th>
                    <th className="text-right px-4 py-3 font-medium">Forecast Stops</th>
                    <th className="text-right px-4 py-3 font-medium">Demand (t)</th>
                    <th className="text-right px-4 py-3 font-medium">Capacity (t)</th>
                    <th className="text-right px-4 py-3 font-medium">Vehicles</th>
                    <th className="text-right px-4 py-3 font-medium">Utilisation</th>
                    <th className="text-right px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tomorrowPlans.map(plan => {
                    const cfg = STATUS_CONFIG[plan.status] || STATUS_CONFIG.ok;
                    const zone = zoneMap[plan.zone_id];
                    return (
                      <tr key={plan.id} className="border-t hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium">{zone?.name || plan.zone_id?.slice(0, 8) || '—'}</td>
                        <td className="px-4 py-3 text-right">{plan.forecast_stops || 0}</td>
                        <td className="px-4 py-3 text-right">{(plan.forecast_demand_t || 0).toFixed(1)}</td>
                        <td className="px-4 py-3 text-right">{(plan.planned_capacity_t || 0).toFixed(1)}</td>
                        <td className="px-4 py-3 text-right">{plan.available_vehicles || 0}</td>
                        <td className="px-4 py-3 text-right font-semibold">{plan.utilisation_pct || 0}%</td>
                        <td className="px-4 py-3 text-right">
                          <Badge className={cfg.color}>{cfg.label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}