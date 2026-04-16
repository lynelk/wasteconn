import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Radio, RefreshCw, Truck, MapPin, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';

export default function WialonIntegration() {
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });
  const { data: telematics = [] } = useQuery({ queryKey: ['telematics'], queryFn: () => base44.entities.VehicleTelematics.list('-timestamp', 200) });
  const { data: routes = [] } = useQuery({ queryKey: ['routes'], queryFn: () => base44.entities.Route.list('-route_date', 100) });

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    const res = await base44.functions.invoke('wialonSync', {});
    setSyncResult(res.data);
    qc.invalidateQueries({ queryKey: ['telematics'] });
    qc.invalidateQueries({ queryKey: ['vehicles'] });
    setSyncing(false);
  };

  // Link telematics to routes by vehicle + time window
  const routeWithTelematics = routes.map(route => {
    const vehicleTelems = telematics.filter(t => {
      if (t.vehicle_id !== route.vehicle_id) return false;
      if (!route.started_at || !t.timestamp) return true;
      const ts = new Date(t.timestamp);
      const start = new Date(route.started_at);
      const end = route.completed_at ? new Date(route.completed_at) : new Date();
      return ts >= start && ts <= end;
    });

    const idlingPoints = vehicleTelems.filter(t => (t.engine_idle_seconds || 0) > 600);
    const deviations = vehicleTelems.filter(t => t.deviation_alert_sent);
    const maxSpeed = Math.max(...vehicleTelems.map(t => t.speed_kmh || 0), 0);

    return { ...route, telemetryCount: vehicleTelems.length, idlingCount: idlingPoints.length, deviationCount: deviations.length, maxSpeed };
  });

  const latestByVehicle = vehicles.map(v => {
    const latest = telematics.filter(t => t.vehicle_id === v.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
    return { vehicle: v, latest };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-jakarta flex items-center gap-2">
            <Radio className="w-6 h-6 text-primary" /> Wialon Telematics
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Vehicle registry sync, GPS positions/trips, route deviation & idling flags</p>
        </div>
        <Button onClick={handleSync} disabled={syncing} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync from Wialon'}
        </Button>
      </div>

      {syncResult && (
        <Card className={`border-${syncResult.error ? 'red' : 'green'}-200 bg-${syncResult.error ? 'red' : 'green'}-50/50`}>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              {syncResult.error ? <AlertTriangle className="w-4 h-4 text-red-600" /> : <CheckCircle2 className="w-4 h-4 text-green-600" />}
              <span className="text-sm">{syncResult.error || `Synced ${syncResult.vehicles_synced || 0} vehicles, ${syncResult.positions_ingested || 0} positions`}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Tracked Vehicles', value: latestByVehicle.filter(v => v.latest).length, color: 'text-blue-600' },
          { label: 'Telemetry Points', value: telematics.length, color: 'text-purple-600' },
          { label: 'Idling Alerts', value: telematics.filter(t => (t.engine_idle_seconds||0) > 600).length, color: 'text-orange-600' },
          { label: 'Deviation Alerts', value: telematics.filter(t => t.deviation_alert_sent).length, color: 'text-red-600' },
        ].map(s => (
          <Card key={s.label} className="border-border/60">
            <CardContent className="pt-4 pb-4">
              <div className={`text-2xl font-bold font-jakarta ${s.color}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="vehicles">
        <TabsList>
          <TabsTrigger value="vehicles">Live Vehicle Status</TabsTrigger>
          <TabsTrigger value="routes">Route Telemetry Review</TabsTrigger>
        </TabsList>

        <TabsContent value="vehicles" className="mt-4">
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {latestByVehicle.map(({ vehicle, latest }) => (
              <Card key={vehicle.id} className="border-border/60">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-sm font-jakarta">{vehicle.registration_number}</p>
                      <p className="text-xs text-muted-foreground capitalize">{vehicle.vehicle_type} · {vehicle.make} {vehicle.model}</p>
                    </div>
                    <Badge variant="secondary" className={`text-[10px] ${latest ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {latest ? 'Online' : 'Offline'}
                    </Badge>
                  </div>
                  {latest ? (
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1"><MapPin className="w-3 h-3" />{latest.latitude?.toFixed(4)}, {latest.longitude?.toFixed(4)}</div>
                      <div className="flex items-center gap-2">
                        <span>Speed: <strong className="text-foreground">{latest.speed_kmh || 0} km/h</strong></span>
                        <span>Fuel: <strong className="text-foreground">{latest.fuel_level_pct || 0}%</strong></span>
                      </div>
                      {(latest.engine_idle_seconds || 0) > 600 && (
                        <div className="flex items-center gap-1 text-orange-600"><Clock className="w-3 h-3" />Idling {Math.round((latest.engine_idle_seconds||0)/60)}min</div>
                      )}
                      {latest.deviation_alert_sent && (
                        <div className="flex items-center gap-1 text-red-600"><AlertTriangle className="w-3 h-3" />Route deviation detected</div>
                      )}
                      <div className="text-[10px] text-muted-foreground/60">{latest.timestamp ? format(new Date(latest.timestamp), 'dd MMM HH:mm') : '—'}</div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No telemetry data</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="routes" className="mt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Route</th>
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">GPS Points</th>
                  <th className="pb-2 font-medium">Max Speed</th>
                  <th className="pb-2 font-medium">Idling Alerts</th>
                  <th className="pb-2 font-medium">Deviations</th>
                </tr>
              </thead>
              <tbody>
                {routeWithTelematics.map(r => (
                  <tr key={r.id} className="border-b border-border/30 hover:bg-muted/30">
                    <td className="py-2 font-medium text-xs">{r.route_name || r.id.slice(0,8)}</td>
                    <td className="py-2 text-xs">{r.route_date}</td>
                    <td className="py-2"><Badge variant="secondary" className="text-[10px]">{r.status}</Badge></td>
                    <td className="py-2 text-xs">{r.telemetryCount}</td>
                    <td className="py-2 text-xs">{r.maxSpeed} km/h</td>
                    <td className="py-2">
                      {r.idlingCount > 0 ? <Badge className="text-[10px] bg-orange-100 text-orange-700" variant="secondary">{r.idlingCount}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="py-2">
                      {r.deviationCount > 0 ? <Badge className="text-[10px] bg-red-100 text-red-700" variant="secondary">{r.deviationCount}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}