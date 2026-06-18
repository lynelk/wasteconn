import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, ZAxis, Legend } from 'recharts';
import { Route, TrendingUp, Fuel, Zap, Award, AlertTriangle } from 'lucide-react';

const effColor = (v) => {
  if (v == null) return 'text-muted-foreground';
  if (v >= 8) return 'text-green-600';
  if (v >= 5) return 'text-yellow-600';
  if (v >= 3) return 'text-orange-600';
  return 'text-red-600';
};

const effLabel = (v) => {
  if (v == null) return { label: 'No data', cls: 'bg-gray-100 text-gray-500' };
  if (v >= 8) return { label: 'Excellent', cls: 'bg-green-100 text-green-700' };
  if (v >= 5) return { label: 'Good', cls: 'bg-yellow-100 text-yellow-700' };
  if (v >= 3) return { label: 'Fair', cls: 'bg-orange-100 text-orange-700' };
  return { label: 'Poor', cls: 'bg-red-100 text-red-700' };
};

export default function RouteEfficiencyComparison({ fuelLogs, vehicles, routes }) {
  const vehicleMap = useMemo(() => {
    const m = {};
    vehicles.forEach(v => { m[v.id] = v; });
    return m;
  }, [vehicles]);

  const routeMap = useMemo(() => {
    const m = {};
    routes.forEach(r => { m[r.id] = r; });
    return m;
  }, [routes]);

  // Per-vehicle aggregation
  const vehicleStats = useMemo(() => {
    const map = {};
    fuelLogs.forEach(fl => {
      const vid = fl.vehicle_id;
      if (!vid) return;
      if (!map[vid]) map[vid] = { id: vid, entries: 0, litres: 0, kwh: 0, cost: 0, effReadings: [] };
      map[vid].entries++;
      map[vid].litres += fl.litres || 0;
      map[vid].kwh += fl.kwh_consumed || 0;
      map[vid].cost += fl.cost_ugx || 0;
      if (fl.efficiency_km_per_litre) map[vid].effReadings.push(fl.efficiency_km_per_litre);
      if (fl.efficiency_km_per_kwh) map[vid].effReadings.push(fl.efficiency_km_per_kwh);
    });
    return Object.values(map).map(d => {
      const v = vehicleMap[d.id];
      const avgEff = d.effReadings.length > 0 ? d.effReadings.reduce((a, b) => a + b, 0) / d.effReadings.length : null;
      return {
        ...d,
        reg: v?.registration_number || d.id.slice(0, 8),
        type: v?.vehicle_type || 'unknown',
        fuelType: v?.fuel_type || 'diesel',
        avgEff: avgEff ? Math.round(avgEff * 10) / 10 : null,
        costPerKm: avgEff && d.cost > 0 ? Math.round(d.cost / (d.litres * avgEff)) : null,
      };
    }).sort((a, b) => (b.avgEff || 0) - (a.avgEff || 0));
  }, [fuelLogs, vehicleMap]);

  // Per-route aggregation (only logs linked to a route)
  const routeStats = useMemo(() => {
    const map = {};
    fuelLogs.filter(fl => fl.route_id).forEach(fl => {
      const rid = fl.route_id;
      if (!map[rid]) map[rid] = { id: rid, entries: 0, litres: 0, cost: 0, effReadings: [] };
      map[rid].entries++;
      map[rid].litres += fl.litres || 0;
      map[rid].cost += fl.cost_ugx || 0;
      if (fl.efficiency_km_per_litre) map[rid].effReadings.push(fl.efficiency_km_per_litre);
    });
    return Object.values(map).map(d => {
      const r = routeMap[d.id];
      const avgEff = d.effReadings.length > 0 ? d.effReadings.reduce((a, b) => a + b, 0) / d.effReadings.length : null;
      return {
        ...d,
        name: r?.route_name || 'Route ' + d.id.slice(0, 6),
        zone: r?.zone_id || '—',
        avgEff: avgEff ? Math.round(avgEff * 10) / 10 : null,
      };
    }).sort((a, b) => (b.avgEff || 0) - (a.avgEff || 0)).slice(0, 10);
  }, [fuelLogs, routeMap]);

  // Fleet benchmarks
  const fleetAvg = useMemo(() => {
    const all = vehicleStats.filter(v => v.avgEff != null);
    return all.length > 0 ? all.reduce((s, v) => s + v.avgEff, 0) / all.length : null;
  }, [vehicleStats]);

  const topPerformer = vehicleStats[0];
  const worstPerformer = vehicleStats[vehicleStats.length - 1];

  const chartData = vehicleStats.slice(0, 10).map(v => ({
    name: v.reg,
    efficiency: v.avgEff || 0,
    cost: Math.round(v.cost / 1000),
  }));

  return (
    <div className="space-y-5">
      {/* Fleet Benchmark Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border/60"><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Fuel className="w-3 h-3" />Fleet Avg km/L</p>
          <p className={`text-2xl font-bold font-jakarta ${effColor(fleetAvg)}`}>{fleetAvg ? `${fleetAvg.toFixed(1)}` : '—'}</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Award className="w-3 h-3 text-green-500" />Top Performer</p>
          <p className="text-base font-bold font-jakarta text-green-600">{topPerformer?.reg || '—'}</p>
          <p className="text-[11px] text-muted-foreground">{topPerformer?.avgEff ? `${topPerformer.avgEff} km/L` : ''}</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-orange-500" />Needs Review</p>
          <p className="text-base font-bold font-jakarta text-orange-600">{worstPerformer?.avgEff ? worstPerformer.reg : '—'}</p>
          <p className="text-[11px] text-muted-foreground">{worstPerformer?.avgEff ? `${worstPerformer.avgEff} km/L` : ''}</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><TrendingUp className="w-3 h-3" />Vehicles Tracked</p>
          <p className="text-2xl font-bold font-jakarta">{vehicleStats.length}</p>
        </CardContent></Card>
      </div>

      {/* Vehicle Efficiency Bar Chart */}
      {chartData.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold font-jakarta">Vehicle Efficiency Comparison (km/L)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={70} />
                <Tooltip formatter={(v) => [`${v} km/L`, 'Efficiency']} />
                <Bar dataKey="efficiency" name="km/L" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            {fleetAvg && (
              <p className="text-xs text-muted-foreground mt-2 text-center">Fleet average: {fleetAvg.toFixed(1)} km/L</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Vehicle Breakdown Table */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold font-jakarta">Vehicle-Level Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {vehicleStats.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No fuel data available. Log fuel entries to see comparisons.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60">
                  {['Vehicle', 'Type', 'Fuel', 'Entries', 'Litres', 'Total Cost', 'Avg km/L', 'Rating'].map(h => (
                    <th key={h} className="text-left text-xs text-muted-foreground pb-2 pr-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {vehicleStats.map((v, i) => {
                  const rating = effLabel(v.avgEff);
                  const isBelowAvg = fleetAvg && v.avgEff && v.avgEff < fleetAvg * 0.8;
                  return (
                    <tr key={v.id} className={`hover:bg-muted/20 transition-colors ${isBelowAvg ? 'bg-orange-50/40' : ''}`}>
                      <td className="py-2 pr-3 text-xs font-semibold">
                        {i === 0 && <span className="mr-1">🏆</span>}{v.reg}
                      </td>
                      <td className="py-2 pr-3 text-xs capitalize text-muted-foreground">{v.type}</td>
                      <td className="py-2 pr-3 text-xs capitalize">
                        {v.fuelType === 'electric' ? <span className="flex items-center gap-0.5 text-yellow-600"><Zap className="w-3 h-3" />EV</span> : v.fuelType}
                      </td>
                      <td className="py-2 pr-3 text-xs">{v.entries}</td>
                      <td className="py-2 pr-3 text-xs">{v.litres.toFixed(0)}L</td>
                      <td className="py-2 pr-3 text-xs">UGX {(v.cost / 1000).toFixed(0)}K</td>
                      <td className="py-2 pr-3 text-xs">
                        <span className={`font-semibold ${effColor(v.avgEff)}`}>
                          {v.avgEff ? `${v.avgEff}` : '—'}
                        </span>
                        {isBelowAvg && <AlertTriangle className="w-3 h-3 inline ml-1 text-orange-500" />}
                      </td>
                      <td className="py-2 pr-3">
                        <Badge className={`text-[10px] ${rating.cls}`} variant="secondary">{rating.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Route Comparison */}
      {routeStats.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold font-jakarta flex items-center gap-2">
              <Route className="w-4 h-4 text-primary" /> Route Efficiency Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    {['Route', 'Fuel Entries', 'Total Litres', 'Avg km/L', 'Rating'].map(h => (
                      <th key={h} className="text-left text-xs text-muted-foreground pb-2 pr-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {routeStats.map(r => {
                    const rating = effLabel(r.avgEff);
                    return (
                      <tr key={r.id} className="hover:bg-muted/20">
                        <td className="py-2 pr-3 text-xs font-medium">{r.name}</td>
                        <td className="py-2 pr-3 text-xs">{r.entries}</td>
                        <td className="py-2 pr-3 text-xs">{r.litres.toFixed(0)}L</td>
                        <td className="py-2 pr-3 text-xs">
                          <span className={`font-semibold ${effColor(r.avgEff)}`}>{r.avgEff ?? '—'}</span>
                        </td>
                        <td className="py-2">
                          <Badge className={`text-[10px] ${rating.cls}`} variant="secondary">{rating.label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Only routes with linked fuel entries are shown. Assign a route_id when logging fuel to track per-route efficiency.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}