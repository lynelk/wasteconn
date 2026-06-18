import { useMemo } from 'react';
import { Zap, TrendingUp, AlertTriangle, Battery } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';

const getEfficiencyLabel = (kmPerKwh) => {
  if (kmPerKwh == null) return null;
  if (kmPerKwh >= 6) return { label: 'Excellent', color: 'text-green-700', bg: 'bg-green-100' };
  if (kmPerKwh >= 4) return { label: 'Good', color: 'text-blue-700', bg: 'bg-blue-100' };
  if (kmPerKwh >= 2.5) return { label: 'Average', color: 'text-yellow-700', bg: 'bg-yellow-100' };
  return { label: 'Poor', color: 'text-red-700', bg: 'bg-red-100' };
};

export default function EVEfficiencyAnalytics({ fuelLogs = [], vehicles = [] }) {
  const evLogs = useMemo(() => fuelLogs.filter(f => f.fuel_type === 'electric'), [fuelLogs]);
  const evVehicles = useMemo(() => vehicles.filter(v => v.fuel_type === 'electric'), [vehicles]);

  const vehicleMap = useMemo(() => {
    const m = {};
    vehicles.forEach(v => { m[v.id] = v; });
    return m;
  }, [vehicles]);

  // Per-vehicle EV stats
  const vehicleStats = useMemo(() => {
    const map = {};
    for (const log of evLogs) {
      if (!map[log.vehicle_id]) map[log.vehicle_id] = { totalKwh: 0, totalCost: 0, entries: 0, efficiencies: [] };
      map[log.vehicle_id].totalKwh += log.kwh_consumed || 0;
      map[log.vehicle_id].totalCost += log.cost_ugx || 0;
      map[log.vehicle_id].entries += 1;
      if (log.efficiency_km_per_kwh != null) map[log.vehicle_id].efficiencies.push(log.efficiency_km_per_kwh);
    }
    return Object.entries(map).map(([vid, s]) => ({
      reg: vehicleMap[vid]?.registration_number || vid.slice(0, 8),
      vid,
      ...s,
      avgEfficiency: s.efficiencies.length > 0 ? s.efficiencies.reduce((a, b) => a + b, 0) / s.efficiencies.length : null,
    })).sort((a, b) => (b.avgEfficiency || 0) - (a.avgEfficiency || 0));
  }, [evLogs, vehicleMap]);

  // Monthly trend
  const monthlyTrend = useMemo(() => {
    const monthly = {};
    for (const log of evLogs) {
      if (!log.fuel_date) continue;
      const key = log.fuel_date.slice(0, 7);
      if (!monthly[key]) monthly[key] = { month: key, totalKwh: 0, totalCost: 0, effEntries: [], count: 0 };
      monthly[key].totalKwh += log.kwh_consumed || 0;
      monthly[key].totalCost += log.cost_ugx || 0;
      monthly[key].count += 1;
      if (log.efficiency_km_per_kwh != null) monthly[key].effEntries.push(log.efficiency_km_per_kwh);
    }
    return Object.values(monthly)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12)
      .map(d => ({
        label: format(parseISO(d.month + '-01'), 'MMM yy'),
        kWh: Math.round(d.totalKwh),
        avgEff: d.effEntries.length > 0 ? parseFloat((d.effEntries.reduce((a, b) => a + b, 0) / d.effEntries.length).toFixed(2)) : null,
        costK: Math.round(d.totalCost / 1000),
      }));
  }, [evLogs]);

  const fleetAvgEff = useMemo(() => {
    const effs = evLogs.filter(l => l.efficiency_km_per_kwh != null).map(l => l.efficiency_km_per_kwh);
    return effs.length > 0 ? effs.reduce((a, b) => a + b, 0) / effs.length : null;
  }, [evLogs]);

  const totalKwh = evLogs.reduce((s, l) => s + (l.kwh_consumed || 0), 0);
  const totalCost = evLogs.reduce((s, l) => s + (l.cost_ugx || 0), 0);

  if (evVehicles.length === 0 && evLogs.length === 0) {
    return (
      <Card className="border-border/60">
        <CardContent className="py-16 text-center">
          <Zap className="w-10 h-10 mx-auto mb-3 text-yellow-400 opacity-50" />
          <p className="font-semibold text-sm">No Electric Vehicles Found</p>
          <p className="text-xs text-muted-foreground mt-1">Add vehicles with fuel type "electric" and log energy usage to see EV analytics.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border/60 border-yellow-200">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-1.5 mb-1"><Zap className="w-4 h-4 text-yellow-500" /><span className="text-xs text-muted-foreground">Total kWh Consumed</span></div>
            <p className="text-xl font-bold font-jakarta">{totalKwh.toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-1.5 mb-1"><Battery className="w-4 h-4 text-primary" /><span className="text-xs text-muted-foreground">Fleet Avg (km/kWh)</span></div>
            <p className={`text-xl font-bold font-jakarta ${fleetAvgEff != null && fleetAvgEff < 2.5 ? 'text-red-600' : 'text-primary'}`}>
              {fleetAvgEff != null ? `${fleetAvgEff.toFixed(2)} km/kWh` : '—'}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="pt-4 pb-3">
            <span className="text-xs text-muted-foreground block mb-1">Total Energy Cost</span>
            <p className="text-lg font-bold font-jakarta">UGX {totalCost.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="pt-4 pb-3">
            <span className="text-xs text-muted-foreground block mb-1">EV Vehicles / Log Entries</span>
            <p className="text-xl font-bold font-jakarta">{evVehicles.length} <span className="text-sm font-normal text-muted-foreground">/ {evLogs.length}</span></p>
          </CardContent>
        </Card>
      </div>

      {/* Per-vehicle table */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold font-jakarta flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> EV Performance by Vehicle
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {vehicleStats.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No EV energy logs yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60">
                  {['Vehicle', 'Entries', 'Total kWh', 'Avg km/kWh', 'Rating', 'Total Cost (UGX)'].map(h => (
                    <th key={h} className="text-left text-xs text-muted-foreground pb-2 pr-4 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {vehicleStats.map(v => {
                  const eff = getEfficiencyLabel(v.avgEfficiency);
                  return (
                    <tr key={v.vid} className="hover:bg-muted/20">
                      <td className="py-2 pr-4 font-medium text-xs">{v.reg}</td>
                      <td className="py-2 pr-4 text-xs text-muted-foreground">{v.entries}</td>
                      <td className="py-2 pr-4 text-xs">{v.totalKwh.toLocaleString(undefined, { maximumFractionDigits: 1 })} kWh</td>
                      <td className="py-2 pr-4 text-xs font-semibold text-yellow-700">
                        {v.avgEfficiency != null ? `${v.avgEfficiency.toFixed(2)} km/kWh` : '—'}
                      </td>
                      <td className="py-2 pr-4">
                        {eff ? (
                          <Badge className={`text-xs ${eff.bg} ${eff.color}`} variant="secondary">{eff.label}</Badge>
                        ) : '—'}
                      </td>
                      <td className="py-2 text-xs">{v.totalCost.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Monthly trend charts */}
      {monthlyTrend.length > 1 && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold font-jakarta">Monthly kWh Consumption</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={v => [`${v} kWh`]} contentStyle={{ fontSize: 12, borderRadius: '0.5rem' }} />
                  <Bar dataKey="kWh" name="kWh Consumed" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold font-jakarta">Avg Efficiency Trend (km/kWh)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={v => [`${v} km/kWh`]} contentStyle={{ fontSize: 12, borderRadius: '0.5rem' }} />
                  <Line dataKey="avgEff" name="km/kWh" type="monotone" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* vs ICE comparison note */}
      {fleetAvgEff != null && (
        <div className="flex items-start gap-2 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-xl px-4 py-3">
          <Zap className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
          <p className="text-xs text-yellow-800 dark:text-yellow-200">
            Fleet EV average: <strong>{fleetAvgEff.toFixed(2)} km/kWh</strong>. A typical diesel vehicle achieves ~5–8 km/L. To compare energy cost parity, use the fuel cost per km metric in the Efficiency Analysis tab.
          </p>
        </div>
      )}
    </div>
  );
}