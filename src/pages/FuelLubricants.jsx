import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Fuel, BarChart2, Plus, TrendingUp, Zap, AlertTriangle } from 'lucide-react';
import EVEfficiencyAnalytics from '@/components/fuel/EVEfficiencyAnalytics';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import FuelLogForm from '@/components/fleet/FuelLogForm';
import EfficiencyHeatmap from '@/components/fleet/EfficiencyHeatmap';
import FuelEfficiencyDashboard from '@/components/fuel/FuelEfficiencyDashboard';
import RouteEfficiencyComparison from '@/components/fuel/RouteEfficiencyComparison';

export default function FuelLubricants() {
  const queryClient = useQueryClient();
  const [showFuelForm, setShowFuelForm] = useState(false);
  const [filterVehicle, setFilterVehicle] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const { data: fuelLogs = [], isLoading } = useQuery({
    queryKey: ['fuel-logs'],
    queryFn: () => base44.entities.FuelLog.list('-fuel_date', 500),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const { data: routes = [] } = useQuery({
    queryKey: ['routes'],
    queryFn: () => base44.entities.Route.list('-route_date', 200),
  });

  const vehicleMap = useMemo(() => {
    const m = {};
    vehicles.forEach(v => { m[v.id] = v; });
    return m;
  }, [vehicles]);

  const getVehicleReg = (id) => vehicleMap[id]?.registration_number || id?.slice(0, 8) || '—';

  // Filtered logs for the management tab
  const filteredLogs = useMemo(() => {
    return fuelLogs.filter(f => {
      if (filterVehicle && f.vehicle_id !== filterVehicle) return false;
      if (filterDateFrom && f.fuel_date < filterDateFrom) return false;
      if (filterDateTo && f.fuel_date > filterDateTo) return false;
      return true;
    });
  }, [fuelLogs, filterVehicle, filterDateFrom, filterDateTo]);

  const totalCost = filteredLogs.reduce((s, f) => s + (f.cost_ugx || 0), 0);
  const totalLitres = filteredLogs.reduce((s, f) => s + (f.litres || 0), 0);
  const totalKwh = filteredLogs.reduce((s, f) => s + (f.kwh_consumed || 0), 0);
  const effLogs = filteredLogs.filter(f => f.efficiency_km_per_litre);
  const avgEfficiency = effLogs.length > 0
    ? effLogs.reduce((s, f) => s + f.efficiency_km_per_litre, 0) / effLogs.length
    : null;

  // Fleet-level anomalies: logs where efficiency < 70% of fleet avg
  const anomalyCount = avgEfficiency != null
    ? filteredLogs.filter(f => f.efficiency_km_per_litre != null && f.efficiency_km_per_litre < avgEfficiency * 0.7).length
    : 0;

  const hasEVs = vehicles.some(v => v.fuel_type === 'electric');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-jakarta">Fuel &amp; Energy Management</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Track fuel consumption, EV energy, and fleet efficiency</p>
        </div>
        <Button size="sm" onClick={() => setShowFuelForm(true)}>
          <Plus className="w-4 h-4" /> Log Fuel Entry
        </Button>
      </div>

      {/* Global Filters */}
      <div className="flex flex-wrap gap-3 items-center p-3 bg-muted/40 rounded-xl border border-border/50">
        <select
          className="border border-input rounded-lg px-3 py-1.5 text-sm bg-background"
          value={filterVehicle} onChange={e => setFilterVehicle(e.target.value)}
        >
          <option value="">All Vehicles</option>
          {vehicles.map(v => <option key={v.id} value={v.id}>{v.registration_number}</option>)}
        </select>
        <input type="date" className="border border-input rounded-lg px-3 py-1.5 text-sm bg-background"
          value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} placeholder="From" />
        <input type="date" className="border border-input rounded-lg px-3 py-1.5 text-sm bg-background"
          value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} placeholder="To" />
        {(filterVehicle || filterDateFrom || filterDateTo) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterVehicle(''); setFilterDateFrom(''); setFilterDateTo(''); }}>
            Clear
          </Button>
        )}
        {(filterVehicle || filterDateFrom || filterDateTo) && (
          <Badge variant="secondary" className="text-xs">{filteredLogs.length} entries</Badge>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border/60"><CardContent className="pt-5 pb-4">
          <div className="text-2xl font-bold font-jakarta">{filteredLogs.length}</div>
          <p className="text-xs text-muted-foreground mt-1">Total Entries</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="pt-5 pb-4">
          {hasEVs && totalKwh > 0 ? (
            <>
              <div className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-yellow-500" />
                <div className="text-xl font-bold font-jakarta">{totalKwh.toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh</div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{totalLitres > 0 ? `+ ${totalLitres.toLocaleString(undefined, { maximumFractionDigits: 0 })}L diesel` : 'Total Energy'}</p>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold font-jakarta">{totalLitres.toLocaleString(undefined, { maximumFractionDigits: 0 })}L</div>
              <p className="text-xs text-muted-foreground mt-1">Total Litres</p>
            </>
          )}
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="pt-5 pb-4">
          <div className="text-lg font-bold font-jakarta">UGX {totalCost.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground mt-1">Total Cost</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="pt-5 pb-4">
          <div className={`text-2xl font-bold font-jakarta ${avgEfficiency != null && avgEfficiency < 5 ? 'text-red-600' : avgEfficiency != null && avgEfficiency >= 8 ? 'text-green-600' : ''}`}>
            {avgEfficiency != null ? `${avgEfficiency.toFixed(1)} km/L` : '—'}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Fleet Avg Efficiency</p>
        </CardContent></Card>
      </div>

      {/* Anomaly banner */}
      {anomalyCount > 0 && (
        <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-2.5">
          <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0" />
          <p className="text-sm text-orange-800">
            <strong>{anomalyCount} entries</strong> show unusually high fuel consumption (30%+ below average). Review them in the table below.
          </p>
        </div>
      )}

      <Tabs defaultValue="management">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="management"><Fuel className="w-3.5 h-3.5 mr-1.5" />Fuel Log</TabsTrigger>
          <TabsTrigger value="analytics"><TrendingUp className="w-3.5 h-3.5 mr-1.5" />Efficiency Analysis</TabsTrigger>
          <TabsTrigger value="ev"><Zap className="w-3.5 h-3.5 mr-1.5" />EV Analytics</TabsTrigger>
          <TabsTrigger value="routes"><BarChart2 className="w-3.5 h-3.5 mr-1.5" />Vehicle & Route Compare</TabsTrigger>
          <TabsTrigger value="heatmap"><BarChart2 className="w-3.5 h-3.5 mr-1.5" />Heatmap</TabsTrigger>
        </TabsList>

        {/* ── Fuel Management Tab ── */}
        <TabsContent value="management" className="mt-4">
          {isLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-12 bg-muted rounded-xl animate-pulse" />)}</div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-14 text-muted-foreground text-sm border border-dashed rounded-xl">
              <Fuel className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No fuel logs found. {fuelLogs.length > 0 ? 'Try adjusting the filters.' : 'Click "Log Fuel Entry" to get started.'}
            </div>
          ) : (
            <Card className="border-border/60">
              <CardContent className="overflow-x-auto pt-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60">
                      {['Date', 'Vehicle', 'Driver', 'Litres / kWh', 'Cost (UGX)', 'Odometer', 'km/L', 'Station', 'Type', 'Anomaly'].map(h => (
                        <th key={h} className="text-left text-xs text-muted-foreground pb-2 pr-3 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {filteredLogs.map(log => {
                      const isAnomaly = avgEfficiency != null && log.efficiency_km_per_litre != null && log.efficiency_km_per_litre < avgEfficiency * 0.7;
                      const isEV = log.fuel_type === 'electric';
                      return (
                        <tr key={log.id} className={`hover:bg-muted/20 transition-colors ${isAnomaly ? 'bg-orange-50/50' : ''}`}>
                          <td className="py-2 pr-3 text-xs whitespace-nowrap">{log.fuel_date}</td>
                          <td className="py-2 pr-3 text-xs font-medium">{getVehicleReg(log.vehicle_id)}</td>
                          <td className="py-2 pr-3 text-xs text-muted-foreground">{log.driver_id ? log.driver_id.slice(0, 8) : '—'}</td>
                          <td className="py-2 pr-3 text-xs">
                            {isEV ? (
                              <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-yellow-500" />{log.kwh_consumed != null ? `${log.kwh_consumed} kWh` : '—'}</span>
                            ) : `${log.litres || '—'}L`}
                          </td>
                          <td className="py-2 pr-3 text-xs">{(log.cost_ugx || 0).toLocaleString()}</td>
                          <td className="py-2 pr-3 text-xs">{log.odometer_km ? `${log.odometer_km.toLocaleString()} km` : '—'}</td>
                          <td className="py-2 pr-3 text-xs">
                            {isEV ? (
                              log.efficiency_km_per_kwh != null ? (
                                <span className="font-semibold text-yellow-600">{log.efficiency_km_per_kwh.toFixed(1)} km/kWh</span>
                              ) : '—'
                            ) : log.efficiency_km_per_litre != null ? (
                              <span className={`font-semibold ${
                                log.efficiency_km_per_litre >= 8 ? 'text-green-700' :
                                log.efficiency_km_per_litre >= 5 ? 'text-yellow-700' :
                                log.efficiency_km_per_litre >= 3 ? 'text-orange-700' : 'text-red-700'
                              }`}>{log.efficiency_km_per_litre.toFixed(1)}</span>
                            ) : '—'}
                          </td>
                          <td className="py-2 pr-3 text-xs text-muted-foreground">{log.station_name || '—'}</td>
                          <td className="py-2 pr-3 text-xs capitalize text-muted-foreground">{log.fuel_type || 'diesel'}</td>
                          <td className="py-2 text-xs">
                            {isAnomaly && (
                              <span className="flex items-center gap-1 text-orange-600"><AlertTriangle className="w-3 h-3" />High</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Efficiency Analysis Tab ── */}
        <TabsContent value="analytics" className="mt-4">
          <FuelEfficiencyDashboard fuelLogs={filteredLogs} vehicles={vehicles} routes={routes} />
        </TabsContent>

        {/* ── EV Analytics Tab ── */}
        <TabsContent value="ev" className="mt-4">
          <EVEfficiencyAnalytics fuelLogs={filteredLogs} vehicles={vehicles} />
        </TabsContent>

        {/* ── Vehicle & Route Comparison Tab ── */}
        <TabsContent value="routes" className="mt-4">
          <RouteEfficiencyComparison fuelLogs={filteredLogs} vehicles={vehicles} routes={routes} />
        </TabsContent>

        {/* ── Heatmap Tab ── */}
        <TabsContent value="heatmap" className="mt-4">
          <EfficiencyHeatmap fuelLogs={filteredLogs} vehicles={vehicles} />
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