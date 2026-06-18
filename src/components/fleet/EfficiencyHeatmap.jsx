import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Flame } from 'lucide-react';

// Color coding mirrors the Excel sheet:
// >= 8 km/L  → green (excellent)
// 5–7.99     → yellow (acceptable)
// 3–4.99     → orange (poor)
// < 3        → red (critical)
function efficiencyColor(kpl) {
  if (kpl == null) return { bg: 'bg-gray-100', text: 'text-gray-400', label: '—' };
  if (kpl >= 8) return { bg: 'bg-green-100', text: 'text-green-700', label: 'Excellent' };
  if (kpl >= 5) return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Acceptable' };
  if (kpl >= 3) return { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Poor' };
  return { bg: 'bg-red-100', text: 'text-red-700', label: 'Critical' };
}

export default function EfficiencyHeatmap({ fuelLogs = [], vehicles = [] }) {
  const vehicleMap = useMemo(() => {
    const m = {};
    vehicles.forEach(v => { m[v.id] = v.registration_number || v.id.slice(0, 8); });
    return m;
  }, [vehicles]);

  // Group logs by vehicle, then by month
  const grid = useMemo(() => {
    const byVehicle = {};
    for (const log of fuelLogs) {
      if (!log.efficiency_km_per_litre) continue;
      const month = log.fuel_date?.slice(0, 7); // "YYYY-MM"
      if (!month) continue;
      if (!byVehicle[log.vehicle_id]) byVehicle[log.vehicle_id] = {};
      if (!byVehicle[log.vehicle_id][month]) byVehicle[log.vehicle_id][month] = [];
      byVehicle[log.vehicle_id][month].push(log.efficiency_km_per_litre);
    }
    // Average per vehicle per month
    const rows = {};
    for (const [vid, months] of Object.entries(byVehicle)) {
      rows[vid] = {};
      for (const [month, vals] of Object.entries(months)) {
        rows[vid][month] = vals.reduce((s, v) => s + v, 0) / vals.length;
      }
    }
    return rows;
  }, [fuelLogs]);

  const months = useMemo(() => {
    const set = new Set();
    Object.values(grid).forEach(months => Object.keys(months).forEach(m => set.add(m)));
    return [...set].sort().slice(-6); // last 6 months
  }, [grid]);

  const vehicleIds = Object.keys(grid);

  if (vehicleIds.length === 0) {
    return (
      <Card className="border-border/60">
        <CardContent className="py-14 text-center text-muted-foreground text-sm">
          <Flame className="w-8 h-8 mx-auto mb-2 opacity-30" />
          No efficiency data yet. Log fuel entries with odometer readings to see the heatmap.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {[
          { bg: 'bg-green-100', text: 'text-green-700', label: '≥ 8 km/L — Excellent' },
          { bg: 'bg-yellow-100', text: 'text-yellow-700', label: '5–7.99 km/L — Acceptable' },
          { bg: 'bg-orange-100', text: 'text-orange-700', label: '3–4.99 km/L — Poor' },
          { bg: 'bg-red-100', text: 'text-red-700', label: '< 3 km/L — Critical' },
        ].map(l => (
          <span key={l.label} className={`px-2 py-1 rounded-md font-medium ${l.bg} ${l.text}`}>{l.label}</span>
        ))}
      </div>

      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold font-jakarta flex items-center gap-2">
            <Flame className="w-4 h-4 text-primary" />
            Fuel Efficiency Heatmap — km/L (Last 6 Months)
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="text-left text-muted-foreground pb-2 pr-4 font-medium">Vehicle</th>
                {months.map(m => (
                  <th key={m} className="text-center text-muted-foreground pb-2 px-2 font-medium min-w-[80px]">
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {vehicleIds.map(vid => (
                <tr key={vid}>
                  <td className="py-2 pr-4 font-semibold text-xs whitespace-nowrap">
                    {vehicleMap[vid] || vid.slice(0, 8)}
                  </td>
                  {months.map(m => {
                    const val = grid[vid]?.[m];
                    const { bg, text } = efficiencyColor(val);
                    return (
                      <td key={m} className="py-1.5 px-2 text-center">
                        <span className={`inline-block rounded-md px-2 py-1 font-semibold ${bg} ${text} min-w-[56px]`}>
                          {val != null ? val.toFixed(1) : '—'}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}