import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Wrench, Fuel, TrendingUp, AlertTriangle, Calendar, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const statusColor = {
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};
const priorityColor = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

export default function VehicleDetailModal({ vehicle, onClose }) {
  const { data: workOrders = [] } = useQuery({
    queryKey: ['work-orders-vehicle', vehicle.id],
    queryFn: () => base44.entities.MaintenanceWorkOrder.filter({ vehicle_id: vehicle.id }, '-created_date', 50),
  });

  const { data: fuelLogs = [] } = useQuery({
    queryKey: ['fuel-logs-vehicle', vehicle.id],
    queryFn: () => base44.entities.FuelLog.filter({ vehicle_id: vehicle.id }, '-fuel_date', 100),
  });

  const stats = useMemo(() => {
    const totalRepairCost = workOrders.reduce((s, wo) =>
      s + (wo.parts_cost_ugx || 0) + (wo.labour_cost_ugx || 0) + (wo.hired_truck_cost_ugx || 0) + (wo.hired_driver_cost_ugx || 0), 0);
    const budget = vehicle.quarterly_maintenance_budget_ugx || 0;
    const budgetUsedPct = budget > 0 ? Math.min(100, Math.round(totalRepairCost / budget * 100)) : null;
    const totalFuelCost = fuelLogs.reduce((s, f) => s + (f.cost_ugx || 0), 0);
    const totalLitres = fuelLogs.reduce((s, f) => s + (f.litres || 0), 0);
    const effLogs = fuelLogs.filter(f => f.efficiency_km_per_litre);
    const avgEff = effLogs.length > 0 ? effLogs.reduce((s, f) => s + f.efficiency_km_per_litre, 0) / effLogs.length : null;

    // Monthly fuel trend (last 6 months)
    const monthlyFuel = {};
    fuelLogs.forEach(f => {
      const m = f.fuel_date?.slice(0, 7);
      if (m) {
        if (!monthlyFuel[m]) monthlyFuel[m] = { month: m, litres: 0, cost: 0 };
        monthlyFuel[m].litres += f.litres || 0;
        monthlyFuel[m].cost += f.cost_ugx || 0;
      }
    });
    const fuelTrend = Object.values(monthlyFuel).sort((a, b) => a.month.localeCompare(b.month)).slice(-6).map(d => ({
      ...d,
      month: d.month.slice(5) + '/' + d.month.slice(2, 4),
    }));

    return { totalRepairCost, budget, budgetUsedPct, totalFuelCost, totalLitres, avgEff, fuelTrend };
  }, [workOrders, fuelLogs, vehicle]);

  const typeLabel = { truck: 'Truck', tipper: 'Tipper', compactor: 'Compactor', pickup: 'Pickup', tricycle: 'Tricycle' };
  const statusLabel = { available: 'Available', on_route: 'On Route', maintenance: 'Maintenance', retired: 'Retired' };
  const statusVehicleColor = { available: 'bg-green-100 text-green-700', on_route: 'bg-blue-100 text-blue-700', maintenance: 'bg-orange-100 text-orange-700', retired: 'bg-gray-100 text-gray-500' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border/60 sticky top-0 bg-card z-10">
          <div>
            <h2 className="text-xl font-bold font-jakarta">{vehicle.registration_number}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={`text-xs ${statusVehicleColor[vehicle.status]}`} variant="secondary">{statusLabel[vehicle.status]}</Badge>
              <span className="text-xs text-muted-foreground capitalize">{typeLabel[vehicle.vehicle_type]} · {vehicle.make_model || 'Unknown model'} · {vehicle.year || '—'}</span>
              <span className="text-xs text-muted-foreground capitalize">Fuel: {vehicle.fuel_type}</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        <div className="p-6 space-y-5">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border-border/60"><CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Wrench className="w-3 h-3" />Repair Cost</p>
              <p className="text-lg font-bold font-jakarta">UGX {(stats.totalRepairCost / 1000000).toFixed(1)}M</p>
              <p className="text-[11px] text-muted-foreground">{workOrders.length} work orders</p>
            </CardContent></Card>
            <Card className="border-border/60"><CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><DollarSign className="w-3 h-3" />Quarterly Budget</p>
              {stats.budget > 0 ? (
                <>
                  <p className={`text-lg font-bold font-jakarta ${stats.budgetUsedPct >= 100 ? 'text-red-600' : stats.budgetUsedPct >= 80 ? 'text-orange-600' : 'text-green-600'}`}>
                    {stats.budgetUsedPct}%
                  </p>
                  <p className="text-[11px] text-muted-foreground">UGX {(stats.budget / 1000000).toFixed(1)}M budget</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground italic mt-1">Not set</p>
              )}
            </CardContent></Card>
            <Card className="border-border/60"><CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Fuel className="w-3 h-3" />Total Fuel</p>
              <p className="text-lg font-bold font-jakarta">{stats.totalLitres.toFixed(0)}L</p>
              <p className="text-[11px] text-muted-foreground">UGX {(stats.totalFuelCost / 1000000).toFixed(1)}M</p>
            </CardContent></Card>
            <Card className="border-border/60"><CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><TrendingUp className="w-3 h-3" />Avg Efficiency</p>
              <p className={`text-lg font-bold font-jakarta ${stats.avgEff ? (stats.avgEff >= 8 ? 'text-green-600' : stats.avgEff >= 5 ? 'text-yellow-600' : 'text-red-600') : ''}`}>
                {stats.avgEff ? `${stats.avgEff.toFixed(1)} km/L` : '—'}
              </p>
            </CardContent></Card>
          </div>

          {/* Budget Progress */}
          {stats.budget > 0 && (
            <Card className="border-border/60">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">Quarterly Maintenance Budget</p>
                  <p className="text-sm text-muted-foreground">UGX {stats.totalRepairCost.toLocaleString()} / {stats.budget.toLocaleString()}</p>
                </div>
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${stats.budgetUsedPct >= 100 ? 'bg-red-500' : stats.budgetUsedPct >= 80 ? 'bg-orange-500' : 'bg-primary'}`}
                    style={{ width: `${Math.min(stats.budgetUsedPct, 100)}%` }}
                  />
                </div>
                {stats.budgetUsedPct >= 80 && (
                  <p className="text-xs text-orange-600 mt-1.5 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {stats.budgetUsedPct >= 100 ? 'Budget exceeded!' : 'Approaching budget limit'}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Fuel Trend Chart */}
          {stats.fuelTrend.length > 0 && (
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold font-jakarta">Monthly Fuel Consumption</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={stats.fuelTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v, n) => [n === 'litres' ? `${v.toFixed(0)}L` : `UGX ${v.toLocaleString()}`, n === 'litres' ? 'Litres' : 'Cost']} />
                    <Bar dataKey="litres" name="litres" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Work Orders */}
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold font-jakarta flex items-center gap-2">
                <Wrench className="w-4 h-4 text-primary" /> Maintenance History ({workOrders.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {workOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No work orders yet.</p>
              ) : (
                <div className="space-y-2">
                  {workOrders.slice(0, 10).map(wo => {
                    const totalCost = (wo.parts_cost_ugx || 0) + (wo.labour_cost_ugx || 0) + (wo.hired_truck_cost_ugx || 0) + (wo.hired_driver_cost_ugx || 0);
                    return (
                      <div key={wo.id} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <Badge className={`text-[10px] ${priorityColor[wo.priority]}`} variant="secondary">{wo.priority}</Badge>
                            <Badge className={`text-[10px] ${statusColor[wo.status]}`} variant="secondary">{wo.status?.replace('_', ' ')}</Badge>
                          </div>
                          <p className="text-xs font-medium truncate">{wo.title}</p>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          {totalCost > 0 && <p className="text-xs font-semibold">UGX {totalCost.toLocaleString()}</p>}
                          <p className="text-[11px] text-muted-foreground">{wo.scheduled_date || wo.created_date?.split('T')[0] || '—'}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Service Dates */}
          <Card className="border-border/60">
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><Calendar className="w-3 h-3" />Last Service</p>
                  <p className="font-medium">{vehicle.last_service_date || <span className="text-muted-foreground italic">Not recorded</span>}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><Calendar className="w-3 h-3" />Next Service Due</p>
                  <p className={`font-medium ${vehicle.next_service_date && new Date(vehicle.next_service_date) < new Date() ? 'text-red-600' : ''}`}>
                    {vehicle.next_service_date || <span className="text-muted-foreground italic">Not scheduled</span>}
                    {vehicle.next_service_date && new Date(vehicle.next_service_date) < new Date() && (
                      <Badge className="ml-2 text-[10px] bg-red-100 text-red-700" variant="secondary">OVERDUE</Badge>
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}