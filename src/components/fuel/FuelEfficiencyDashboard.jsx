import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, ScatterChart, Scatter, ZAxis
} from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle, Award, Fuel, Zap } from 'lucide-react';

function effColor(kpl) {
  if (kpl == null) return 'text-muted-foreground';
  if (kpl >= 8) return 'text-green-600';
  if (kpl >= 5) return 'text-yellow-600';
  if (kpl >= 3) return 'text-orange-600';
  return 'text-red-600';
}

function effBadge(kpl) {
  if (kpl == null) return { label: '—', cls: 'bg-gray-100 text-gray-500' };
  if (kpl >= 8) return { label: 'Excellent', cls: 'bg-green-100 text-green-700' };
  if (kpl >= 5) return { label: 'Acceptable', cls: 'bg-yellow-100 text-yellow-700' };
  if (kpl >= 3) return { label: 'Poor', cls: 'bg-orange-100 text-orange-700' };
  return { label: 'Critical', cls: 'bg-red-100 text-red-700' };
}

export default function FuelEfficiencyDashboard({ fuelLogs = [], vehicles = [], routes = [] }) {
  const [compareBy, setCompareBy] = useState('vehicle'); // 'vehicle' | 'route'

  const vehicleMap = useMemo(() => {
    const m = {};
    vehicles.forEach(v => { m[v.id] = { reg: v.registration_number, type: v.vehicle_type, fuel_type: v.fuel_type }; });
    return m;
  }, [vehicles]);

  const routeMap = useMemo(() => {
    const m = {};
    routes.forEach(r => { m[r.id] = r.route_name || r.id?.slice(0, 8); });
    return m;
  }, [routes]);

  // Per-vehicle aggregation
  const vehicleStats = useMemo(() => {
    const stats = {};
    for (const log of fuelLogs) {
      if (!log.vehicle_id) continue;
      const vid = log.vehicle_id;
      if (!stats[vid]) stats[vid] = { litres: 0, cost: 0, effReadings: [], entries: 0 };
      stats[vid].litres += log.litres || 0;
      stats[vid].cost += log.cost_ugx || 0;
      if (log.efficiency_km_per_litre) stats[vid].effReadings.push(log.efficiency_km_per_litre);
      stats[vid].entries++;
    }
    return Object.entries(stats).map(([vid, s]) => ({
      id: vid,
      label: vehicleMap[vid]?.reg || vid.slice(0, 8),
      type: vehicleMap[vid]?.type || '—',
      fuelType: vehicleMap[vid]?.fuel_type || 'diesel',
      totalLitres: Math.round(s.litres * 10) / 10,
      totalCost: s.cost,
      avgEff: s.effReadings.length ? Math.round(s.effReadings.reduce((a, b) => a + b, 0) / s.effReadings.length * 10) / 10 : null,
      entries: s.entries,
    })).sort((a, b) => (b.avgEff ?? 0) - (a.avgEff ?? 0));
  }, [fuelLogs, vehicleMap]);

  // Monthly trend per vehicle (top 5)
  const topVehicles = vehicleStats.slice(0, 5);
  const monthlyTrend = useMemo(() => {
    const byMonth = {};
    for (const log of fuelLogs) {
      const month = log.fuel_date?.slice(0, 7);
      if (!month || !log.efficiency_km_per_litre) continue;
      const reg = vehicleMap[log.vehicle_id]?.reg || log.vehicle_id?.slice(0, 8);
      if (!topVehicles.find(v => v.id === log.vehicle_id)) continue;
      if (!byMonth[month]) byMonth[month] = {};
      if (!byMonth[month][reg]) byMonth[month][reg] = [];
      byMonth[month][reg].push(log.efficiency_km_per_litre);
    }
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, regs]) => {
        const entry = { month };
        for (const [reg, vals] of Object.entries(regs)) {
          entry[reg] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10;
        }
        return entry;
      });
  }, [fuelLogs, vehicleMap, topVehicles]);

  // Cost per litre trend
  const costTrend = useMemo(() => {
    const byMonth = {};
    for (const log of fuelLogs) {
      const month = log.fuel_date?.slice(0, 7);
      if (!month || !log.litres || !log.cost_ugx) continue;
      if (!byMonth[month]) byMonth[month] = { cost: 0, litres: 0 };
      byMonth[month].cost += log.cost_ugx;
      byMonth[month].litres += log.litres;
    }
    return Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([month, d]) => ({
      month,
      costPerLitre: d.litres ? Math.round(d.cost / d.litres) : 0,
      totalLitres: Math.round(d.litres),
    }));
  }, [fuelLogs]);

  // Fleet-wide KPIs
  const fleetAvgEff = vehicleStats.filter(v => v.avgEff != null).length > 0
    ? Math.round(vehicleStats.filter(v => v.avgEff != null).reduce((s, v) => s + v.avgEff, 0) / vehicleStats.filter(v => v.avgEff != null).length * 10) / 10
    : null;
  const bestVehicle = vehicleStats[0];
  const worstVehicle = vehicleStats[vehicleStats.length - 1];
  const anomalies = vehicleStats.filter(v => v.avgEff != null && fleetAvgEff != null && v.avgEff < fleetAvgEff * 0.7);

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  if (fuelLogs.length === 0) {
    return (
      <Card className="border-border/60">
        <CardContent className="py-16 text-center text-muted-foreground">
          <Fuel className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No fuel logs yet. Add fuel entries to see efficiency analytics.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Fleet KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border/60 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Fleet Avg Efficiency</p>
            <p className={`text-2xl font-bold font-jakarta mt-1 ${effColor(fleetAvgEff)}`}>
              {fleetAvgEff != null ? `${fleetAvgEff} km/L` : '—'}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-1.5 mb-1"><Award className="w-3.5 h-3.5 text-green-600" /><p className="text-xs text-muted-foreground">Best Vehicle</p></div>
            <p className="text-sm font-bold font-jakarta text-green-600">{bestVehicle?.label || '—'}</p>
            <p className="text-xs text-muted-foreground">{bestVehicle?.avgEff != null ? `${bestVehicle.avgEff} km/L` : '—'}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-1.5 mb-1"><TrendingDown className="w-3.5 h-3.5 text-red-500" /><p className="text-xs text-muted-foreground">Needs Attention</p></div>
            <p className="text-sm font-bold font-jakarta text-red-500">{worstVehicle?.avgEff != null && worstVehicle?.avgEff < (fleetAvgEff || 5) ? worstVehicle?.label : '—'}</p>
            <p className="text-xs text-muted-foreground">{worstVehicle?.avgEff != null ? `${worstVehicle.avgEff} km/L` : '—'}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-1.5 mb-1"><AlertTriangle className="w-3.5 h-3.5 text-orange-500" /><p className="text-xs text-muted-foreground">Anomalies</p></div>
            <p className={`text-2xl font-bold font-jakarta mt-1 ${anomalies.length > 0 ? 'text-orange-500' : 'text-green-600'}`}>{anomalies.length}</p>
            <p className="text-xs text-muted-foreground">vehicles below avg</p>
          </CardContent>
        </Card>
      </div>

      {/* Anomaly Banner */}
      {anomalies.length > 0 && (
        <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-orange-800">Fuel Anomaly Detected</p>
            <p className="text-xs text-orange-700 mt-0.5">
              {anomalies.map(v => v.label).join(', ')} {anomalies.length === 1 ? 'is' : 'are'} consuming significantly more fuel than the fleet average. Consider inspection.
            </p>
          </div>
        </div>
      )}

      {/* Vehicle Comparison Table */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold font-jakarta flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Vehicle Efficiency Comparison
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60">
                <th className="text-left text-xs text-muted-foreground pb-2 pr-4">Rank</th>
                <th className="text-left text-xs text-muted-foreground pb-2 pr-4">Vehicle</th>
                <th className="text-left text-xs text-muted-foreground pb-2 pr-4">Type</th>
                <th className="text-right text-xs text-muted-foreground pb-2 pr-4">Avg Efficiency</th>
                <th className="text-right text-xs text-muted-foreground pb-2 pr-4">Total Litres</th>
                <th className="text-right text-xs text-muted-foreground pb-2 pr-4">Total Cost (UGX)</th>
                <th className="text-right text-xs text-muted-foreground pb-2 pr-4">Entries</th>
                <th className="text-left text-xs text-muted-foreground pb-2">Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {vehicleStats.map((v, i) => {
                const badge = effBadge(v.avgEff);
                return (
                  <tr key={v.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-2 pr-4 text-xs font-bold text-muted-foreground">#{i + 1}</td>
                    <td className="py-2 pr-4 text-xs font-semibold">{v.label}</td>
                    <td className="py-2 pr-4 text-xs capitalize text-muted-foreground">{v.type}</td>
                    <td className={`py-2 pr-4 text-xs text-right font-bold ${effColor(v.avgEff)}`}>
                      {v.fuelType === 'electric' ? (
                        <span className="flex items-center justify-end gap-1"><Zap className="w-3 h-3" />{v.avgEff != null ? `${v.avgEff} km/kWh` : '—'}</span>
                      ) : (
                        v.avgEff != null ? `${v.avgEff} km/L` : '—'
                      )}
                    </td>
                    <td className="py-2 pr-4 text-xs text-right">{v.totalLitres.toLocaleString()}L</td>
                    <td className="py-2 pr-4 text-xs text-right">{v.totalCost.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-xs text-right">{v.entries}</td>
                    <td className="py-2">
                      <Badge className={`text-[10px] ${badge.cls}`} variant="secondary">{badge.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Efficiency Bar Chart */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold font-jakarta">Avg Efficiency by Vehicle (km/L)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={vehicleStats.slice(0, 8).map(v => ({ name: v.label, eff: v.avgEff ?? 0, fill: v.avgEff >= 8 ? '#16a34a' : v.avgEff >= 5 ? '#ca8a04' : v.avgEff >= 3 ? '#ea580c' : '#dc2626' }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v} km/L`, 'Efficiency']} />
                <Bar dataKey="eff" radius={[4, 4, 0, 0]} fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Cost per Litre Trend */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold font-jakarta">Cost per Litre Trend (UGX)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={costTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [v.toLocaleString(), 'UGX/L']} />
                <Line type="monotone" dataKey="costPerLitre" name="Cost/L" stroke="hsl(38,92%,50%)" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Efficiency Trend (top vehicles) */}
      {monthlyTrend.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold font-jakarta">Monthly Efficiency Trend — Top 5 Vehicles (km/L)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {topVehicles.map((v, i) => (
                  <Line key={v.id} type="monotone" dataKey={v.label} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}