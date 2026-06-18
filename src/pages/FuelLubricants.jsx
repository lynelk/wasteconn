import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Fuel, BarChart2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import FuelLogForm from '@/components/fleet/FuelLogForm';
import EfficiencyHeatmap from '@/components/fleet/EfficiencyHeatmap';

export default function FuelLubricants() {
  const queryClient = useQueryClient();
  const [showFuelForm, setShowFuelForm] = useState(false);

  const { data: fuelLogs = [], isLoading } = useQuery({
    queryKey: ['fuel-logs'],
    queryFn: () => base44.entities.FuelLog.list('-fuel_date', 200),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const getVehicleReg = (id) => vehicles.find(v => v.id === id)?.registration_number || id?.slice(0, 8) || '—';

  const totalCost = fuelLogs.reduce((s, f) => s + (f.cost_ugx || 0), 0);
  const totalLitres = fuelLogs.reduce((s, f) => s + (f.litres || 0), 0);
  const avgEfficiency = fuelLogs.filter(f => f.efficiency_km_per_litre).length > 0
    ? (fuelLogs.filter(f => f.efficiency_km_per_litre).reduce((s, f) => s + f.efficiency_km_per_litre, 0) / fuelLogs.filter(f => f.efficiency_km_per_litre).length)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-jakarta">Fuel &amp; Lubricants</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Track fuel consumption, costs, and fleet efficiency</p>
        </div>
        <Button size="sm" onClick={() => setShowFuelForm(true)}>
          <Plus className="w-4 h-4" /> Log Fuel Entry
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border/60"><CardContent className="pt-5 pb-4">
          <div className="text-2xl font-bold font-jakarta">{fuelLogs.length}</div>
          <p className="text-xs text-muted-foreground mt-1">Total Entries</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="pt-5 pb-4">
          <div className="text-2xl font-bold font-jakarta">{totalLitres.toLocaleString(undefined, { maximumFractionDigits: 0 })}L</div>
          <p className="text-xs text-muted-foreground mt-1">Total Litres</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="pt-5 pb-4">
          <div className="text-lg font-bold font-jakarta">UGX {totalCost.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground mt-1">Total Cost</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="pt-5 pb-4">
          <div className="text-2xl font-bold font-jakarta">{avgEfficiency != null ? `${avgEfficiency.toFixed(1)}` : '—'}</div>
          <p className="text-xs text-muted-foreground mt-1">Avg km/L (Fleet)</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="management">
        <TabsList>
          <TabsTrigger value="management"><Fuel className="w-3.5 h-3.5 mr-1.5" />Fuel Management</TabsTrigger>
          <TabsTrigger value="efficiency"><BarChart2 className="w-3.5 h-3.5 mr-1.5" />Efficiency Management</TabsTrigger>
        </TabsList>

        {/* ── Fuel Management Tab ── */}
        <TabsContent value="management" className="mt-4">
          {isLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-12 bg-muted rounded-xl animate-pulse" />)}</div>
          ) : fuelLogs.length === 0 ? (
            <div className="text-center py-14 text-muted-foreground text-sm border border-dashed rounded-xl">
              <Fuel className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No fuel logs yet. Click "Log Fuel Entry" to get started.
            </div>
          ) : (
            <Card className="border-border/60">
              <CardContent className="overflow-x-auto pt-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60">
                      {['Date', 'Vehicle', 'Driver', 'Litres', 'Cost (UGX)', 'Odometer', 'km/L', 'Station', 'Fuel Type'].map(h => (
                        <th key={h} className="text-left text-xs text-muted-foreground pb-2 pr-3 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {fuelLogs.map(log => (
                      <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-2 pr-3 text-xs whitespace-nowrap">{log.fuel_date}</td>
                        <td className="py-2 pr-3 text-xs font-medium">{getVehicleReg(log.vehicle_id)}</td>
                        <td className="py-2 pr-3 text-xs text-muted-foreground">{log.driver_id ? log.driver_id.slice(0, 8) : '—'}</td>
                        <td className="py-2 pr-3 text-xs">{log.litres}L</td>
                        <td className="py-2 pr-3 text-xs">{(log.cost_ugx || 0).toLocaleString()}</td>
                        <td className="py-2 pr-3 text-xs">{log.odometer_km ? `${log.odometer_km.toLocaleString()} km` : '—'}</td>
                        <td className="py-2 pr-3 text-xs">
                          {log.efficiency_km_per_litre != null ? (
                            <span className={`font-semibold ${
                              log.efficiency_km_per_litre >= 8 ? 'text-green-700' :
                              log.efficiency_km_per_litre >= 5 ? 'text-yellow-700' :
                              log.efficiency_km_per_litre >= 3 ? 'text-orange-700' : 'text-red-700'
                            }`}>{log.efficiency_km_per_litre.toFixed(1)}</span>
                          ) : '—'}
                        </td>
                        <td className="py-2 pr-3 text-xs text-muted-foreground">{log.station_name || '—'}</td>
                        <td className="py-2 text-xs capitalize text-muted-foreground">{log.fuel_type || 'diesel'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Efficiency Management Tab ── */}
        <TabsContent value="efficiency" className="mt-4">
          <EfficiencyHeatmap fuelLogs={fuelLogs} vehicles={vehicles} />
        </TabsContent>
      </Tabs>

      {showFuelForm && (
        <FuelLogForm
          vehicles={vehicles}
          onClose={() => setShowFuelForm(false)}
          onSaved={() => { queryClient.invalidateQueries({ queryKey: ['fuel-logs'] }); setShowFuelForm(false); }}
        />
      )}
    </div>
  );
}