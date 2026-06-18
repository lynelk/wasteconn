import { useMemo } from 'react';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { format, parseISO, startOfMonth } from 'date-fns';

export default function MaintenanceTrendChart({ workOrders, vehicles }) {
  const chartData = useMemo(() => {
    const monthly = {};
    for (const wo of workOrders) {
      if (wo.status === 'cancelled') continue;
      const dateStr = wo.completed_date || wo.scheduled_date || wo.created_date?.split('T')[0];
      if (!dateStr) continue;
      const monthKey = dateStr.slice(0, 7); // YYYY-MM
      if (!monthly[monthKey]) monthly[monthKey] = { month: monthKey, parts: 0, labour: 0, hired: 0, total: 0, orders: 0 };
      monthly[monthKey].parts += wo.parts_cost_ugx || 0;
      monthly[monthKey].labour += wo.labour_cost_ugx || 0;
      monthly[monthKey].hired += (wo.hired_truck_cost_ugx || 0) + (wo.hired_driver_cost_ugx || 0);
      monthly[monthKey].total += (wo.parts_cost_ugx || 0) + (wo.labour_cost_ugx || 0) + (wo.hired_truck_cost_ugx || 0) + (wo.hired_driver_cost_ugx || 0);
      monthly[monthKey].orders += 1;
    }

    return Object.values(monthly)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12) // Last 12 months
      .map(d => ({
        ...d,
        label: format(parseISO(d.month + '-01'), 'MMM yy'),
        parts: Math.round(d.parts / 1000),
        labour: Math.round(d.labour / 1000),
        hired: Math.round(d.hired / 1000),
        total: Math.round(d.total / 1000),
      }));
  }, [workOrders]);

  // Identify vehicles with high cumulative costs (lifecycle risk)
  const vehicleRisk = useMemo(() => {
    const totals = {};
    for (const wo of workOrders) {
      if (!wo.vehicle_id || wo.status === 'cancelled') continue;
      if (!totals[wo.vehicle_id]) totals[wo.vehicle_id] = 0;
      totals[wo.vehicle_id] += (wo.parts_cost_ugx || 0) + (wo.labour_cost_ugx || 0);
    }
    return Object.entries(totals)
      .map(([vid, cost]) => {
        const v = vehicles.find(x => x.id === vid);
        return { reg: v?.registration_number || vid.slice(0, 8), cost, budget: v?.quarterly_maintenance_budget_ugx || 0 };
      })
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 3);
  }, [workOrders, vehicles]);

  if (chartData.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-xl">
        No maintenance cost data available yet.
      </div>
    );
  }

  const formatUGX = (v) => `UGX ${(v * 1000).toLocaleString()}`;

  return (
    <div className="space-y-4">
      {vehicleRisk.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {vehicleRisk.map(v => (
            <div key={v.reg} className="flex items-center gap-2 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg px-3 py-1.5 text-xs">
              <span className="font-semibold text-orange-700 dark:text-orange-400">{v.reg}</span>
              <span className="text-orange-600 dark:text-orange-500">UGX {(v.cost / 1000000).toFixed(1)}M total repairs</span>
              {v.budget > 0 && v.cost > v.budget * 3 && (
                <span className="text-red-600 font-semibold">⚠ Lifecycle risk</span>
              )}
            </div>
          ))}
        </div>
      )}

      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}K`} />
          <Tooltip
            formatter={(value, name) => [`UGX ${(value * 1000).toLocaleString()}`, name]}
            contentStyle={{ fontSize: 12, borderRadius: '0.5rem', border: '1px solid hsl(var(--border))' }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="parts" name="Parts" stackId="a" fill="hsl(var(--chart-3))" radius={[0,0,0,0]} />
          <Bar dataKey="labour" name="Labour" stackId="a" fill="hsl(var(--chart-2))" />
          <Bar dataKey="hired" name="Hired" stackId="a" fill="hsl(var(--chart-4))" radius={[3,3,0,0]} />
          <Line dataKey="total" name="Total Trend" type="monotone" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="text-xs text-muted-foreground text-center">Monthly repair costs (UGX thousands) — stacked by category with trend line</p>
    </div>
  );
}