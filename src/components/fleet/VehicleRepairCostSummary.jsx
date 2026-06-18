import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wrench, TrendingUp, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function VehicleRepairCostSummary({ vehicles = [], workOrders = [] }) {
  const vehicleStats = useMemo(() => {
    const map = {};
    for (const v of vehicles) {
      map[v.id] = {
        id: v.id,
        reg: v.registration_number || v.id.slice(0, 8),
        type: v.vehicle_type,
        status: v.status,
        totalCost: 0,
        orderCount: 0,
        completedCount: 0,
        criticalCount: 0,
        faultCodes: new Set(),
        orders: [],
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
          totalCost: 0,
          orderCount: 0,
          completedCount: 0,
          criticalCount: 0,
          faultCodes: new Set(),
          orders: [],
        };
      }
      const entry = map[wo.vehicle_id];
      entry.totalCost += wo.cost_ugx || 0;
      entry.orderCount += 1;
      if (wo.status === 'completed') entry.completedCount += 1;
      if (wo.priority === 'critical') entry.criticalCount += 1;
      if (Array.isArray(wo.fault_codes)) wo.fault_codes.forEach(fc => entry.faultCodes.add(fc));
      entry.orders.push(wo);
    }

    return Object.values(map)
      .filter(v => v.orderCount > 0)
      .sort((a, b) => b.totalCost - a.totalCost);
  }, [vehicles, workOrders]);

  const totalFleetCost = vehicleStats.reduce((s, v) => s + v.totalCost, 0);
  const chartData = vehicleStats.slice(0, 8).map(v => ({
    name: v.reg,
    cost: v.totalCost,
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
      {/* Fleet total KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="border-border/60"><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Total Fleet Repair Cost</p>
          <p className="text-xl font-bold font-jakarta text-primary mt-1">UGX {totalFleetCost.toLocaleString()}</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Vehicles with Repairs</p>
          <p className="text-2xl font-bold font-jakarta mt-1">{vehicleStats.length}</p>
        </CardContent></Card>
        <Card className="border-border/60 sm:col-span-1 col-span-2"><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Avg Cost / Vehicle</p>
          <p className="text-xl font-bold font-jakarta mt-1">
            UGX {vehicleStats.length > 0 ? Math.round(totalFleetCost / vehicleStats.length).toLocaleString() : 0}
          </p>
        </CardContent></Card>
      </div>

      {/* Bar chart */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold font-jakarta flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Repair Cost by Vehicle (Top 8)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={v => [`UGX ${v.toLocaleString()}`, 'Repair Cost']} />
              <Bar dataKey="cost" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Vehicle breakdown table */}
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
                <th className="text-right text-xs text-muted-foreground pb-2">Total Cost (UGX)</th>
                <th className="text-left text-xs text-muted-foreground pb-2 pl-3">Fault Codes</th>
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
                  <td className="py-2 text-xs text-right font-semibold text-primary">
                    {v.totalCost.toLocaleString()}
                  </td>
                  <td className="py-2 pl-3">
                    <div className="flex flex-wrap gap-1">
                      {[...v.faultCodes].slice(0, 4).map(fc => (
                        <Badge key={fc} className="text-xs bg-orange-100 text-orange-700" variant="secondary">{fc}</Badge>
                      ))}
                      {v.faultCodes.size > 4 && (
                        <Badge className="text-xs bg-muted text-muted-foreground" variant="secondary">+{v.faultCodes.size - 4}</Badge>
                      )}
                      {v.faultCodes.size === 0 && <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                  </td>
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