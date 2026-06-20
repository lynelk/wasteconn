import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Zap, BatteryCharging, BatteryFull, AlertTriangle, Wifi, WifiOff, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const CHARGER_STATUS = {
  available: { label: 'Available', color: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  charging: { label: 'Charging', color: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  faulted: { label: 'Faulted', color: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50 border-red-200' },
  offline: { label: 'Offline', color: 'bg-gray-400', text: 'text-gray-600', bg: 'bg-gray-50 border-gray-200' }
};

function SocBar({ pct }) {
  const color = pct >= 80 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 bg-gray-200 rounded-full h-2">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(100, pct || 0)}%` }} />
      </div>
      <span className="text-xs font-medium w-8 text-right">{pct || 0}%</span>
    </div>
  );
}

export default function DepotEnergy() {
  const { user } = useAuth();
  const [filterVehicle, setFilterVehicle] = useState('');
  const [filterDate, setFilterDate] = useState('');

  const { data: chargers = [], isLoading: loadingChargers } = useQuery({
    queryKey: ['chargers'],
    queryFn: () => base44.entities.Charger.list('-created_date', 100),
    refetchInterval: 30000
  });

  const { data: sessions = [], isLoading: loadingSessions } = useQuery({
    queryKey: ['charging-sessions'],
    queryFn: () => base44.entities.ChargingSession.list('-started_at', 200),
    refetchInterval: 30000
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['ev-vehicles'],
    queryFn: async () => {
      const all = await base44.entities.Vehicle.list('-created_date', 200);
      return all.filter(v => v.fuel_type === 'electric');
    }
  });

  const { data: routes = [] } = useQuery({
    queryKey: ['tomorrow-routes'],
    queryFn: async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tStr = tomorrow.toISOString().split('T')[0];
      return base44.entities.Route.filter({ route_date: tStr });
    }
  });

  if (!['admin', 'super_admin'].includes(user?.role)) {
    return <div className="p-8 text-center text-muted-foreground">Access restricted.</div>;
  }

  const activeSessions = sessions.filter(s => s.status === 'in_progress');
  const vehicleMap = Object.fromEntries(vehicles.map(v => [v.id, v]));
  const chargerMap = Object.fromEntries(chargers.map(c => [c.id, c]));

  // Session log filtered
  const filteredSessions = sessions.filter(s => {
    const matchVehicle = !filterVehicle || s.vehicle_id === filterVehicle;
    const matchDate = !filterDate || (s.started_at || '').startsWith(filterDate);
    return matchVehicle && matchDate;
  });

  // Fleet SoC with tomorrow's route need
  const fleetSoc = vehicles.map(v => {
    const route = routes.find(r => r.vehicle_id === v.id);
    const distKm = route?.estimated_distance_km || 0;
    const efficiency = v.efficiency_kwh_per_km || 0.3;
    const routeEnergyNeeded = distKm * efficiency;
    const currentEnergy = ((v.current_soc_pct || 100) / 100) * (v.battery_capacity_kwh || 100);
    return { ...v, routeEnergyNeeded, currentEnergy, hasRoute: !!route, routeDistKm: distKm };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-jakarta">Depot Energy Management</h1>
        <p className="text-muted-foreground text-sm mt-1">Live EV charging status, session log, and fleet readiness</p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
              <Zap className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{chargers.filter(c => c.status === 'available').length}</p>
              <p className="text-xs text-muted-foreground">Available Chargers</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
              <BatteryCharging className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{activeSessions.length}</p>
              <p className="text-xs text-muted-foreground">Active Sessions</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{chargers.filter(c => c.status === 'faulted').length}</p>
              <p className="text-xs text-muted-foreground">Faulted</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center">
              <BatteryFull className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{vehicles.length}</p>
              <p className="text-xs text-muted-foreground">EV Fleet</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charger Status Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Live Charger Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingChargers ? (
            <div className="flex items-center justify-center h-24">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : chargers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No chargers registered.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {chargers.map(c => {
                const cfg = CHARGER_STATUS[c.status] || CHARGER_STATUS.offline;
                const activeSession = activeSessions.find(s => s.charger_id === c.id);
                const vehicle = activeSession ? vehicleMap[activeSession.vehicle_id] : null;
                return (
                  <div key={c.id} className={`border rounded-xl p-4 ${cfg.bg}`}>
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-semibold text-sm">{c.name || c.ocpp_id || 'Charger'}</p>
                      <div className={`w-2.5 h-2.5 rounded-full ${cfg.color} ${c.status === 'charging' ? 'animate-pulse' : ''}`} />
                    </div>
                    <p className={`text-xs font-medium ${cfg.text} mb-1`}>{cfg.label}</p>
                    <p className="text-xs text-muted-foreground">{c.power_kw} kW · {c.charger_type === 'dc_fast' ? 'DC Fast' : 'AC'}</p>
                    {activeSession && vehicle && (
                      <div className="mt-2 pt-2 border-t border-current/10">
                        <p className="text-xs font-medium">{vehicle.registration_number}</p>
                        <p className="text-xs text-muted-foreground">{activeSession.energy_kwh || 0} kWh delivered</p>
                        <div className="mt-1">
                          <SocBar pct={activeSession.start_soc_pct} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fleet SoC Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BatteryFull className="w-4 h-4" />
            Fleet SoC & Tomorrow's Readiness
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {fleetSoc.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No EV vehicles found. Set fuel_type = electric on your vehicles.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Vehicle</th>
                    <th className="text-right px-4 py-3 font-medium">Current SoC</th>
                    <th className="text-left px-4 py-3 font-medium w-40">Charge Level</th>
                    <th className="text-right px-4 py-3 font-medium">Route Distance</th>
                    <th className="text-right px-4 py-3 font-medium">Energy Needed</th>
                    <th className="text-right px-4 py-3 font-medium">Readiness</th>
                  </tr>
                </thead>
                <tbody>
                  {fleetSoc.map(v => {
                    const sufficient = v.currentEnergy >= v.routeEnergyNeeded;
                    return (
                      <tr key={v.id} className="border-t hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium">{v.registration_number}</td>
                        <td className="px-4 py-3 text-right">{v.current_soc_pct || 100}%</td>
                        <td className="px-4 py-3"><SocBar pct={v.current_soc_pct || 100} /></td>
                        <td className="px-4 py-3 text-right">{v.routeDistKm ? `${v.routeDistKm} km` : '—'}</td>
                        <td className="px-4 py-3 text-right">{v.routeEnergyNeeded ? `${v.routeEnergyNeeded.toFixed(1)} kWh` : '—'}</td>
                        <td className="px-4 py-3 text-right">
                          {v.hasRoute ? (
                            <Badge className={sufficient ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                              {sufficient ? '✓ Ready' : '⚠ Charge Needed'}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">No route</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Session Log */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Charging Session Log</CardTitle>
            <div className="flex gap-2">
              <Select value={filterVehicle} onValueChange={setFilterVehicle}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All vehicles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>All vehicles</SelectItem>
                  {vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.registration_number}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="date" className="w-36" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
              {(filterVehicle || filterDate) && (
                <Button variant="ghost" size="sm" onClick={() => { setFilterVehicle(''); setFilterDate(''); }}>Clear</Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Vehicle</th>
                  <th className="text-left px-4 py-3 font-medium">Charger</th>
                  <th className="text-right px-4 py-3 font-medium">Start SoC</th>
                  <th className="text-right px-4 py-3 font-medium">End SoC</th>
                  <th className="text-right px-4 py-3 font-medium">Energy</th>
                  <th className="text-left px-4 py-3 font-medium">Source</th>
                  <th className="text-left px-4 py-3 font-medium">Started</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.slice(0, 50).map(s => {
                  const v = vehicleMap[s.vehicle_id];
                  const c = chargerMap[s.charger_id];
                  return (
                    <tr key={s.id} className="border-t hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">{v?.registration_number || s.vehicle_id?.slice(0, 8) || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c?.name || c?.ocpp_id || '—'}</td>
                      <td className="px-4 py-3 text-right">{s.start_soc_pct ?? '—'}%</td>
                      <td className="px-4 py-3 text-right">{s.end_soc_pct ?? '—'}%</td>
                      <td className="px-4 py-3 text-right font-medium">{s.energy_kwh ? `${s.energy_kwh} kWh` : '—'}</td>
                      <td className="px-4 py-3 capitalize text-muted-foreground">{s.source || 'grid'}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {s.started_at ? format(new Date(s.started_at), 'dd MMM HH:mm') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={
                          s.status === 'completed' ? 'bg-green-100 text-green-700' :
                          s.status === 'in_progress' ? 'bg-blue-100 text-blue-700 animate-pulse' :
                          'bg-red-100 text-red-700'
                        }>{s.status}</Badge>
                      </td>
                    </tr>
                  );
                })}
                {filteredSessions.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No sessions found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}