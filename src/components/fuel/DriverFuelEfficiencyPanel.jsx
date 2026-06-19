import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { Clock, Fuel, TrendingUp, Zap } from 'lucide-react';

function effColor(kpl) {
  if (kpl == null) return 'text-muted-foreground';
  if (kpl >= 8) return 'text-green-600';
  if (kpl >= 5) return 'text-yellow-600';
  if (kpl >= 3) return 'text-orange-600';
  return 'text-red-600';
}

export default function DriverFuelEfficiencyPanel({ shifts = [], fuelLogs = [], vehicles = [] }) {
  const vehicleMap = useMemo(() => {
    const m = {};
    vehicles.forEach(v => { m[v.id] = v.registration_number || v.id.slice(0, 8); });
    return m;
  }, [vehicles]);

  // Compute shift stats
  const shiftStats = useMemo(() => {
    return shifts.map(s => {
      const hours = s.clock_in && s.clock_out
        ? Math.round((new Date(s.clock_out) - new Date(s.clock_in)) / 3600000 * 10) / 10
        : null;
      const distance = s.start_odometer && s.end_odometer
        ? Math.round(s.end_odometer - s.start_odometer)
        : null;
      return { ...s, hours, distance };
    });
  }, [shifts]);

  const totalHours = shiftStats.reduce((s, sh) => s + (sh.hours || 0), 0);
  const totalDistance = shiftStats.reduce((s, sh) => s + (sh.distance || 0), 0);

  // Match fuel logs to this driver's vehicles used in shifts
  const driverVehicleIds = useMemo(() => [...new Set(shifts.map(s => s.vehicle_id).filter(Boolean))], [shifts]);
  const driverFuelLogs = useMemo(() => fuelLogs.filter(fl => driverVehicleIds.includes(fl.vehicle_id)), [fuelLogs, driverVehicleIds]);

  const totalFuel = driverFuelLogs.reduce((s, fl) => s + (fl.litres || 0), 0);
  const avgEfficiency = driverFuelLogs.filter(fl => fl.efficiency_km_per_litre).length > 0
    ? Math.round(driverFuelLogs.filter(fl => fl.efficiency_km_per_litre).reduce((s, fl) => s + fl.efficiency_km_per_litre, 0) / driverFuelLogs.filter(fl => fl.efficiency_km_per_litre).length * 10) / 10
    : null;

  // Monthly efficiency trend
  const efficiencyTrend = useMemo(() => {
    const byMonth = {};
    for (const fl of driverFuelLogs) {
      const month = fl.fuel_date?.slice(0, 7);
      if (!month || !fl.efficiency_km_per_litre) continue;
      if (!byMonth[month]) byMonth[month] = [];
      byMonth[month].push(fl.efficiency_km_per_litre);
    }
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, vals]) => ({
        month,
        avgEff: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10,
      }));
  }, [driverFuelLogs]);

  // Monthly hours worked
  const hoursPerMonth = useMemo(() => {
    const byMonth = {};
    for (const s of shiftStats) {
      if (!s.clock_in || !s.hours) continue;
      const month = s.clock_in.slice(0, 7);
      byMonth[month] = (byMonth[month] || 0) + s.hours;
    }
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, hours]) => ({ month, hours: Math.round(hours * 10) / 10 }));
  }, [shiftStats]);

  if (shifts.length === 0) {
    return (
      <Card className="border-border/60">
        <CardContent className="py-10 text-center text-muted-foreground text-sm">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
          No shift history found for this driver.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border/60"><CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-1.5 mb-1"><Clock className="w-3.5 h-3.5 text-primary" /><p className="text-xs text-muted-foreground">Total Shifts</p></div>
          <p className="text-2xl font-bold font-jakarta">{shifts.length}</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-1.5 mb-1"><TrendingUp className="w-3.5 h-3.5 text-blue-500" /><p className="text-xs text-muted-foreground">Total Hours</p></div>
          <p className="text-2xl font-bold font-jakarta">{Math.round(totalHours * 10) / 10}h</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-1.5 mb-1"><Fuel className="w-3.5 h-3.5 text-orange-500" /><p className="text-xs text-muted-foreground">Total Fuel (L)</p></div>
          <p className="text-2xl font-bold font-jakarta">{Math.round(totalFuel * 10) / 10}</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-1.5 mb-1"><Zap className="w-3.5 h-3.5 text-green-500" /><p className="text-xs text-muted-foreground">Avg Efficiency</p></div>
          <p className={`text-2xl font-bold font-jakarta ${effColor(avgEfficiency)}`}>
            {avgEfficiency != null ? `${avgEfficiency} km/L` : '—'}
          </p>
        </CardContent></Card>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Efficiency Trend */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold font-jakarta">Fuel Efficiency Trend (km/L)</CardTitle>
          </CardHeader>
          <CardContent>
            {efficiencyTrend.length === 0 ? (
              <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground">No efficiency data</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={efficiencyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${v} km/L`, 'Efficiency']} />
                  <Line type="monotone" dataKey="avgEff" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Hours per Month */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold font-jakarta">Hours Worked per Month</CardTitle>
          </CardHeader>
          <CardContent>
            {hoursPerMonth.length === 0 ? (
              <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground">No hours data</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={hoursPerMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${v}h`, 'Hours']} />
                  <Bar dataKey="hours" fill="hsl(210,70%,60%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Full Shift History Table */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold font-jakarta">Full Shift History</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60">
                <th className="text-left text-xs text-muted-foreground pb-2 pr-3">Date</th>
                <th className="text-left text-xs text-muted-foreground pb-2 pr-3">Clock In</th>
                <th className="text-left text-xs text-muted-foreground pb-2 pr-3">Clock Out</th>
                <th className="text-right text-xs text-muted-foreground pb-2 pr-3">Hours</th>
                <th className="text-right text-xs text-muted-foreground pb-2 pr-3">Distance (km)</th>
                <th className="text-left text-xs text-muted-foreground pb-2 pr-3">Vehicle</th>
                <th className="text-left text-xs text-muted-foreground pb-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {shiftStats.map(s => (
                <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                  <td className="py-2 pr-3 text-xs whitespace-nowrap">{s.clock_in?.slice(0, 10) || '—'}</td>
                  <td className="py-2 pr-3 text-xs whitespace-nowrap">{s.clock_in ? new Date(s.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  <td className="py-2 pr-3 text-xs whitespace-nowrap">{s.clock_out ? new Date(s.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  <td className={`py-2 pr-3 text-xs text-right font-semibold ${s.hours != null ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {s.hours != null ? `${s.hours}h` : '—'}
                  </td>
                  <td className="py-2 pr-3 text-xs text-right">{s.distance != null ? s.distance.toLocaleString() : '—'}</td>
                  <td className="py-2 pr-3 text-xs">{vehicleMap[s.vehicle_id] || '—'}</td>
                  <td className="py-2">
                    <Badge className={`text-[10px] ${s.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`} variant="secondary">
                      {s.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}