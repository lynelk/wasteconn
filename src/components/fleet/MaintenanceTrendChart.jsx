import { useMemo } from 'react';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const LIFECYCLE_THRESHOLDS = {
  AGE_YEARS: 7,          // Vehicles older than 7 years
  COST_MILLIONS: 5,      // Cumulative repairs > 5M UGX
  COST_PER_YEAR: 1.5,    // > 1.5M UGX/year average
};

function getRiskLevel(vehicle, cumulativeCost) {
  const currentYear = new Date().getFullYear();
  const age = vehicle?.year ? currentYear - vehicle.year : 0;
  const costMillions = cumulativeCost / 1_000_000;
  const costPerYear = age > 0 ? costMillions / age : costMillions;

  const flags = [];
  if (age >= LIFECYCLE_THRESHOLDS.AGE_YEARS) flags.push('age');
  if (costMillions >= LIFECYCLE_THRESHOLDS.COST_MILLIONS) flags.push('cost');
  if (costPerYear >= LIFECYCLE_THRESHOLDS.COST_PER_YEAR) flags.push('rate');

  if (flags.length >= 2) return 'critical';
  if (flags.length === 1) return 'warning';
  return 'ok';
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg text-xs space-y-1">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-medium text-foreground">UGX {(p.value * 1000).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

export default function MaintenanceTrendChart({ workOrders, vehicles }) {
  const chartData = useMemo(() => {
    const monthly = {};
    for (const wo of workOrders) {
      if (wo.status === 'cancelled') continue;
      const dateStr = wo.completed_date || wo.scheduled_date || wo.created_date?.split('T')[0];
      if (!dateStr) continue;
      const monthKey = dateStr.slice(0, 7);
      if (!monthly[monthKey]) monthly[monthKey] = { month: monthKey, parts: 0, labour: 0, hired: 0, total: 0, orders: 0 };
      monthly[monthKey].parts += wo.parts_cost_ugx || 0;
      monthly[monthKey].labour += wo.labour_cost_ugx || 0;
      monthly[monthKey].hired += (wo.hired_truck_cost_ugx || 0) + (wo.hired_driver_cost_ugx || 0);
      monthly[monthKey].total += (wo.parts_cost_ugx || 0) + (wo.labour_cost_ugx || 0) + (wo.hired_truck_cost_ugx || 0) + (wo.hired_driver_cost_ugx || 0);
      monthly[monthKey].orders += 1;
    }
    return Object.values(monthly)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12)
      .map(d => ({
        ...d,
        label: format(parseISO(d.month + '-01'), 'MMM yy'),
        parts: Math.round(d.parts / 1000),
        labour: Math.round(d.labour / 1000),
        hired: Math.round(d.hired / 1000),
        total: Math.round(d.total / 1000),
      }));
  }, [workOrders]);

  // Calculate avg monthly cost for reference line
  const avgMonthly = useMemo(() => {
    if (!chartData.length) return 0;
    return Math.round(chartData.reduce((s, d) => s + d.total, 0) / chartData.length);
  }, [chartData]);

  // Trend direction: compare last 3 months avg vs previous 3
  const trendDirection = useMemo(() => {
    if (chartData.length < 4) return 'neutral';
    const last3 = chartData.slice(-3).reduce((s, d) => s + d.total, 0) / 3;
    const prev3 = chartData.slice(-6, -3).reduce((s, d) => s + d.total, 0) / 3;
    if (last3 > prev3 * 1.1) return 'up';
    if (last3 < prev3 * 0.9) return 'down';
    return 'neutral';
  }, [chartData]);

  // Lifecycle risk assessment per vehicle
  const vehicleRisk = useMemo(() => {
    const totals = {};
    for (const wo of workOrders) {
      if (!wo.vehicle_id || wo.status === 'cancelled') continue;
      if (!totals[wo.vehicle_id]) totals[wo.vehicle_id] = 0;
      totals[wo.vehicle_id] += (wo.parts_cost_ugx || 0) + (wo.labour_cost_ugx || 0) + (wo.hired_truck_cost_ugx || 0) + (wo.hired_driver_cost_ugx || 0);
    }
    return Object.entries(totals)
      .map(([vid, cost]) => {
        const v = vehicles.find(x => x.id === vid);
        const age = v?.year ? new Date().getFullYear() - v.year : null;
        const risk = getRiskLevel(v, cost);
        return { reg: v?.registration_number || vid.slice(0, 8), cost, age, risk, makeModel: v?.make_model };
      })
      .filter(v => v.risk !== 'ok')
      .sort((a, b) => {
        const order = { critical: 0, warning: 1, ok: 2 };
        return order[a.risk] - order[b.risk] || b.cost - a.cost;
      });
  }, [workOrders, vehicles]);

  if (chartData.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-xl">
        No maintenance cost data available yet.
      </div>
    );
  }

  const TrendIcon = trendDirection === 'up' ? TrendingUp : trendDirection === 'down' ? TrendingDown : Minus;
  const trendColor = trendDirection === 'up' ? 'text-red-500' : trendDirection === 'down' ? 'text-green-500' : 'text-muted-foreground';

  return (
    <div className="space-y-4">
      {/* Trend summary header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-sm">
          <TrendIcon className={`w-4 h-4 ${trendColor}`} />
          <span className={`font-medium ${trendColor}`}>
            {trendDirection === 'up' ? 'Costs rising' : trendDirection === 'down' ? 'Costs declining' : 'Costs stable'}
          </span>
          <span className="text-muted-foreground text-xs">vs. previous 3-month avg</span>
        </div>
        <span className="text-xs text-muted-foreground">
          Fleet avg: <span className="font-semibold text-foreground">UGX {(avgMonthly * 1000).toLocaleString()}/mo</span>
        </span>
      </div>

      {/* Lifecycle risk badges */}
      {vehicleRisk.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {vehicleRisk.map(v => (
            <div
              key={v.reg}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs border ${
                v.risk === 'critical'
                  ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
                  : 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800'
              }`}
            >
              <AlertTriangle className={`w-3 h-3 ${v.risk === 'critical' ? 'text-red-500' : 'text-orange-500'}`} />
              <span className={`font-semibold ${v.risk === 'critical' ? 'text-red-700 dark:text-red-400' : 'text-orange-700 dark:text-orange-400'}`}>
                {v.reg}
              </span>
              {v.makeModel && <span className="text-muted-foreground">{v.makeModel}</span>}
              {v.age && <span className="text-muted-foreground">{v.age}yr old</span>}
              <span className={v.risk === 'critical' ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-500'}>
                UGX {(v.cost / 1_000_000).toFixed(1)}M repairs
              </span>
              <span className={`font-bold uppercase tracking-wide ${v.risk === 'critical' ? 'text-red-600' : 'text-orange-600'}`}>
                {v.risk === 'critical' ? '⚠ Replace soon' : 'Monitor closely'}
              </span>
            </div>
          ))}
        </div>
      )}

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}K`} axisLine={false} tickLine={false} width={48} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
          {/* Fleet average reference line */}
          <ReferenceLine y={avgMonthly} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" label={{ value: 'Avg', position: 'insideTopRight', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
          <Bar dataKey="parts" name="Parts" stackId="a" fill="hsl(var(--chart-3))" radius={[0,0,0,0]} />
          <Bar dataKey="labour" name="Labour" stackId="a" fill="hsl(var(--chart-2))" />
          <Bar dataKey="hired" name="Hired" stackId="a" fill="hsl(var(--chart-4))" radius={[3,3,0,0]} />
          <Line
            dataKey="total"
            name="Total Cost Trend"
            type="monotoneX"
            stroke="#ef4444"
            strokeWidth={3}
            dot={{ r: 4, fill: '#ef4444', strokeWidth: 2, stroke: '#fff' }}
            activeDot={{ r: 6, fill: '#ef4444' }}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="text-xs text-muted-foreground text-center">Monthly repair costs (UGX thousands) · Last 12 months · Dashed line = fleet monthly average</p>
    </div>
  );
}