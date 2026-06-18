import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, differenceInMinutes } from 'date-fns';
import { Clock, Settings, Users, CheckCircle, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

export default function DriverShiftTracker() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ['driver-shifts'],
    queryFn: () => base44.entities.DriverShift.list('-clock_in', 100),
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const { data: settingsList = [], isLoading: settingsLoading } = useQuery({
    queryKey: ['shift-settings'],
    queryFn: () => base44.entities.ShiftSettings.list(),
  });
  const settings = settingsList[0] || null;

  const saveMutation = useMutation({
    mutationFn: (data) => settings
      ? base44.entities.ShiftSettings.update(settings.id, data)
      : base44.entities.ShiftSettings.create({ tenant_id: '', ...data }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['shift-settings'] }); toast({ title: 'Settings saved' }); },
  });

  const [requireOdo, setRequireOdo] = useState(settings?.require_odometer ?? false);
  const [requireLoc, setRequireLoc] = useState(settings?.require_location ?? false);

  const getDriver = (id) => drivers.find(d => d.id === id)?.full_name || id?.slice(0, 8) || '—';
  const getVehicle = (id) => vehicles.find(v => v.id === id)?.registration_number || id?.slice(0, 8) || '—';
  const getDuration = (shift) => {
    if (!shift.clock_out) return 'Active';
    const mins = differenceInMinutes(new Date(shift.clock_out), new Date(shift.clock_in));
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const activeCount = shifts.filter(s => s.status === 'active').length;
  const todayShifts = shifts.filter(s => s.clock_in?.startsWith(format(new Date(), 'yyyy-MM-dd')));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-jakarta">Driver Shift Tracker</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Monitor active shifts, hours, and odometer records</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border/60"><CardContent className="pt-5 pb-4">
          <div className="text-2xl font-bold font-jakarta text-green-600">{activeCount}</div>
          <p className="text-xs text-muted-foreground mt-1">Active Shifts</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="pt-5 pb-4">
          <div className="text-2xl font-bold font-jakarta">{todayShifts.length}</div>
          <p className="text-xs text-muted-foreground mt-1">Shifts Today</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="pt-5 pb-4">
          <div className="text-2xl font-bold font-jakarta">{shifts.filter(s => s.status === 'completed').length}</div>
          <p className="text-xs text-muted-foreground mt-1">Completed Shifts</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="pt-5 pb-4">
          <div className="text-2xl font-bold font-jakarta">{shifts.length}</div>
          <p className="text-xs text-muted-foreground mt-1">Total Recorded</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="shifts">
        <TabsList>
          <TabsTrigger value="shifts"><Users className="w-3.5 h-3.5 mr-1.5" />Shift Log</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="w-3.5 h-3.5 mr-1.5" />Clock-In Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="shifts" className="mt-4">
          {isLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />)}</div>
          ) : shifts.length === 0 ? (
            <div className="text-center py-14 text-muted-foreground text-sm border border-dashed rounded-xl">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No shifts recorded yet. Drivers clock in from the Driver App.
            </div>
          ) : (
            <Card className="border-border/60">
              <CardContent className="overflow-x-auto pt-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60">
                      {['Driver', 'Vehicle', 'Clock In', 'Clock Out', 'Duration', 'Start Odo', 'End Odo', 'Distance', 'Status'].map(h => (
                        <th key={h} className="text-left text-xs text-muted-foreground pb-2 pr-4 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {shifts.map(s => {
                      const dist = s.start_odometer && s.end_odometer ? s.end_odometer - s.start_odometer : null;
                      return (
                        <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                          <td className="py-2 pr-4 text-xs font-medium">{getDriver(s.driver_id)}</td>
                          <td className="py-2 pr-4 text-xs">{getVehicle(s.vehicle_id)}</td>
                          <td className="py-2 pr-4 text-xs whitespace-nowrap">{s.clock_in ? format(new Date(s.clock_in), 'dd/MM HH:mm') : '—'}</td>
                          <td className="py-2 pr-4 text-xs whitespace-nowrap">{s.clock_out ? format(new Date(s.clock_out), 'dd/MM HH:mm') : '—'}</td>
                          <td className="py-2 pr-4 text-xs">
                            <span className="flex items-center gap-1">
                              <Timer className="w-3 h-3 text-muted-foreground" />{getDuration(s)}
                            </span>
                          </td>
                          <td className="py-2 pr-4 text-xs">{s.start_odometer ? `${s.start_odometer.toLocaleString()} km` : '—'}</td>
                          <td className="py-2 pr-4 text-xs">{s.end_odometer ? `${s.end_odometer.toLocaleString()} km` : '—'}</td>
                          <td className="py-2 pr-4 text-xs">{dist != null ? `${dist.toLocaleString()} km` : '—'}</td>
                          <td className="py-2 text-xs">
                            <Badge className={s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'} variant="secondary">
                              {s.status === 'active' ? <><CheckCircle className="w-3 h-3 mr-1 inline" />Active</> : 'Completed'}
                            </Badge>
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

        <TabsContent value="settings" className="mt-4">
          <Card className="border-border/60 max-w-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Settings className="w-4 h-4" />Clock-In Requirements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Configure what drivers must provide when clocking in or out from the Driver App.</p>
              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" className="mt-0.5 accent-primary"
                    checked={requireOdo}
                    onChange={e => setRequireOdo(e.target.checked)} />
                  <div>
                    <p className="text-sm font-medium">Require Odometer Reading</p>
                    <p className="text-xs text-muted-foreground">Drivers must enter km reading on clock-in and clock-out</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" className="mt-0.5 accent-primary"
                    checked={requireLoc}
                    onChange={e => setRequireLoc(e.target.checked)} />
                  <div>
                    <p className="text-sm font-medium">Require GPS Location</p>
                    <p className="text-xs text-muted-foreground">Drivers must capture their GPS location at clock-in</p>
                  </div>
                </label>
              </div>
              <Button
                onClick={() => saveMutation.mutate({ require_odometer: requireOdo, require_location: requireLoc })}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}