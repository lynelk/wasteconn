import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wrench, TrendingUp, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function VehicleRepairCostSummary({ vehicles = [], workOrders = [] }) {
  const vehicleStats = useMemo(() => {
    const map = {};
    for (const v of vehicles) {
      map[v.id] = {
        id: v.id,
        reg: v.registration_number || v.id.slice(0, 8),
        type: v.vehicle_type,
        status: v.status,
        partsCost: 0,
        labourCost: 0,
        hiredTruckCost: 0,
        hiredDriverCost: 0,
        orderCount: 0,
        completedCount: 0,
        criticalCount: 0,
        faultCodes: new Set(),
      };
    }

    for (const wo of workOrders) {
      if (!wo.vehicle_id) continue;
      if (!map[wo.vehicle_id]) {
        map[wo.vehicle_id] = {
          id: wo.vehicle_id,
          reg: wo.vehicle_id.slice(0, 8),
          type: '—',
          status: '—',
          partsCost: 0,
          labourCost: 0,
          hiredTruckCost: 0,
          hiredDriverCost: 0,
          orderCount: 0,
          completedCount: 0,
          criticalCount: 0,
          faultCodes: new Set(),
        };
      }
      const e = map[wo.vehicle_id];
      e.partsCost += wo.parts_cost_ugx || 0;
      e.labourCost += wo.labour_cost_ugx || 0;
      e.hiredTruckCost += wo.hired_truck_cost_ugx || 0;
      e.hiredDriverCost += wo.hired_driver_cost_ugx || 0;
      e.orderCount += 1;
      if (wo.status === 'completed') e.completedCount += 1;
      if (wo.priority === 'critical') e.criticalCount += 1;
      if (Array.isArray(wo.fault_codes)) wo.fault_codes.forEach(fc => e.faultCodes.add(fc));
    }

    return Object.values(map)
      .map(v => ({ ...v, totalCost: v.partsCost + v.labourCost + v.hiredTruckCost + v.hiredDriverCost }))
      .filter(v => v.orderCount > 0)
      .sort((a, b) => b.totalCost - a.totalCost);
  }, [vehicles, workOrders]);

  const totalFleetCost = vehicleStats.reduce((s, v) => s + v.totalCost, 0);
  const totalParts = vehicleStats.reduce((s, v) => s + v.partsCost, 0);
  const totalLabour = vehicleStats.reduce((s, v) => s + v.labourCost, 0);
  const totalHired = vehicleStats.reduce((s, v) => s + v.hiredTruckCost + v.hiredDriverCost, 0);

  const chartData = vehicleStats.slice(0, 8).map(v => ({
    name: v.reg,
    Parts: v.partsCost,
    Labour: v.labourCost,
    'Hired Truck': v.hiredTruckCost,
    'Hired Driver': v.hiredDriverCost,
  }));

  const typeColor = {
    truck: 'bg-blue-100 text-blue-700',
    tipper: 'bg-purple-100 text-purple-700',
    compactor: 'bg-green-100 text-green-700',
    pickup: 'bg-yellow-100 text-yellow-700',
    tricycle: 'bg-gray-100 text-gray-600',
  };

  if (vehicleStats.length === 0) {
    return (
      <Card className="border-border/60">
        <CardContent className="py-14 text-center text-muted-foreground text-sm">
          <Wrench className="w-8 h-8 mx-auto mb-2 opacity-30" />
          No work orders with cost data yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Fleet KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border/60"><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Total Fleet Repair Cost</p>
          <p className="text-xl font-bold font-jakarta text-primary mt-1">UGX {totalFleetCost.toLocaleString()}</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Parts Cost</p>
          <p className="text-xl font-bold font-jakarta mt-1">UGX {totalParts.toLocaleString()}</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Labour Cost</p>
          <p className="text-xl font-bold font-jakarta mt-1">UGX {totalLabour.toLocaleString()}</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Hired (Truck + Driver)</p>
          <p className="text-xl font-bold font-jakarta mt-1">UGX {totalHired.toLocaleString()}</p>
        </CardContent></Card>
      </div>

      {/* Stacked bar chart */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold font-jakarta flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Cost Breakdown by Vehicle (Top 8)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={v => [`UGX ${Number(v).toLocaleString()}`]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Parts" stackId="a" fill="hsl(var(--chart-1))" />
              <Bar dataKey="Labour" stackId="a" fill="hsl(var(--chart-2))" />
              <Bar dataKey="Hired Truck" stackId="a" fill="hsl(var(--chart-3))" />
              <Bar dataKey="Hired Driver" stackId="a" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Detail table */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold font-jakarta">Vehicle Repair Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60">
                <th className="text-left text-xs text-muted-foreground pb-2">Vehicle</th>
                <th className="text-left text-xs text-muted-foreground pb-2">Type</th>
                <th className="text-right text-xs text-muted-foreground pb-2">Orders</th>
                <th className="text-right text-xs text-muted-foreground pb-2">Parts</th>
                <th className="text-right text-xs text-muted-foreground pb-2">Labour</th>
                <th className="text-right text-xs text-muted-foreground pb-2">Hired Truck</th>
                <th className="text-right text-xs text-muted-foreground pb-2">Hired Driver</th>
                <th className="text-right text-xs text-muted-foreground pb-2 font-bold">Total (UGX)</th>
                <th className="text-left text-xs text-muted-foreground pb-2 pl-3">Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {vehicleStats.map(v => (
                <tr key={v.id}>
                  <td className="py-2 font-medium text-xs">{v.reg}</td>
                  <td className="py-2">
                    <Badge className={`text-xs ${typeColor[v.type] || 'bg-muted text-muted-foreground'}`} variant="secondary">
                      {v.type}
                    </Badge>
                  </td>
                  <td className="py-2 text-xs text-right">{v.orderCount}</td>
                  <td className="py-2 text-xs text-right">{v.partsCost.toLocaleString()}</td>
                  <td className="py-2 text-xs text-right">{v.labourCost.toLocaleString()}</td>
                  <td className="py-2 text-xs text-right">{v.hiredTruckCost.toLocaleString()}</td>
                  <td className="py-2 text-xs text-right">{v.hiredDriverCost.toLocaleString()}</td>
                  <td className="py-2 text-xs text-right font-semibold text-primary">{v.totalCost.toLocaleString()}</td>
                  <td className="py-2 pl-3">
                    {v.criticalCount > 0 && (
                      <span className="flex items-center gap-1 text-xs text-red-600">
                        <AlertTriangle className="w-3 h-3" />{v.criticalCount} critical
                      </span>
                    )}
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