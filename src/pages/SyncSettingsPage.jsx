import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Settings2, Save, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';

export default function SyncSettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['sync-settings'],
    queryFn: () => base44.entities.SyncSettings.list(),
  });

  const existing = settings[0] || {};
  const [form, setForm] = useState(null);

  // Initialize form once data loads
  const current = form ?? {
    inactive_user_sync_interval_minutes: existing.inactive_user_sync_interval_minutes ?? 15,
    max_idle_alert_minutes: existing.max_idle_alert_minutes ?? 10,
    route_deviation_alert_meters: existing.route_deviation_alert_meters ?? 500,
    telematics_provider: existing.telematics_provider ?? 'manual',
    telematics_poll_interval_minutes: existing.telematics_poll_interval_minutes ?? 5,
    quickbooks_enabled: existing.quickbooks_enabled ?? false,
    quickbooks_realm_id: existing.quickbooks_realm_id ?? '',
    quickbooks_sync_direction: existing.quickbooks_sync_direction ?? 'push_only',
  };

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (existing.id) {
        return base44.entities.SyncSettings.update(existing.id, data);
      }
      return base44.entities.SyncSettings.create(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sync-settings'] });
      toast({ title: 'Settings saved', description: 'Sync & integration settings updated.' });
    },
  });

  const set = (key, val) => setForm(f => ({ ...(f ?? current), [key]: val }));

  if (user?.role !== 'super_admin' && user?.role !== 'admin') {
    return <div className="p-8 text-center text-muted-foreground">Access restricted.</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold font-jakarta flex items-center gap-2"><Settings2 className="w-6 h-6" /> System Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Configure sync intervals, telematics, and integrations</p>
      </div>

      {isLoading ? (
        <div className="h-48 bg-muted rounded-xl animate-pulse" />
      ) : (
        <div className="space-y-4">
          {/* Field App Sync */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Field App Background Sync</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Inactive User Sync Interval (minutes)</Label>
                <p className="text-xs text-muted-foreground mb-2">How often the app checks for new assignments and notifications for inactive users</p>
                <Input
                  type="number"
                  min={5}
                  max={60}
                  value={current.inactive_user_sync_interval_minutes}
                  onChange={e => set('inactive_user_sync_interval_minutes', Number(e.target.value))}
                  className="w-36"
                />
              </div>
            </CardContent>
          </Card>

          {/* Fleet / Telematics */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Fleet & Telematics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Telematics Provider</Label>
                <Select value={current.telematics_provider} onValueChange={v => set('telematics_provider', v)}>
                  <SelectTrigger className="w-48 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual / None</SelectItem>
                    <SelectItem value="wialon">Wialon</SelectItem>
                    <SelectItem value="samsara">Samsara</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Telematics Poll Interval (minutes)</Label>
                <Input
                  type="number"
                  min={5}
                  value={current.telematics_poll_interval_minutes}
                  onChange={e => set('telematics_poll_interval_minutes', Number(e.target.value))}
                  className="w-36 mt-1"
                />
              </div>
              <div>
                <Label>Idle Time Alert Threshold (minutes)</Label>
                <p className="text-xs text-muted-foreground mb-2">Engine idle time before generating a fleet alert</p>
                <Input
                  type="number"
                  min={1}
                  value={current.max_idle_alert_minutes}
                  onChange={e => set('max_idle_alert_minutes', Number(e.target.value))}
                  className="w-36"
                />
              </div>
              <div>
                <Label>Route Deviation Alert Distance (meters)</Label>
                <p className="text-xs text-muted-foreground mb-2">Distance off-route before alert fires</p>
                <Input
                  type="number"
                  min={100}
                  value={current.route_deviation_alert_meters}
                  onChange={e => set('route_deviation_alert_meters', Number(e.target.value))}
                  className="w-36"
                />
              </div>
            </CardContent>
          </Card>

          {/* QuickBooks */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">QuickBooks Integration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Switch
                  checked={current.quickbooks_enabled}
                  onCheckedChange={v => set('quickbooks_enabled', v)}
                />
                <Label>Enable QuickBooks Sync</Label>
              </div>
              {current.quickbooks_enabled && (
                <>
                  <div>
                    <Label>QuickBooks Realm ID (Company ID)</Label>
                    <Input
                      value={current.quickbooks_realm_id}
                      onChange={e => set('quickbooks_realm_id', e.target.value)}
                      placeholder="e.g. 1234567890"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Sync Direction</Label>
                    <Select value={current.quickbooks_sync_direction} onValueChange={v => set('quickbooks_sync_direction', v)}>
                      <SelectTrigger className="w-48 mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="push_only">Push to QuickBooks only</SelectItem>
                        <SelectItem value="pull_only">Pull from QuickBooks only</SelectItem>
                        <SelectItem value="bidirectional">Bidirectional</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs text-blue-700 dark:text-blue-300">
                    QuickBooks OAuth connector will be configured separately. Contact your system administrator for OAuth setup instructions.
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Button onClick={() => saveMutation.mutate(current)} disabled={saveMutation.isPending} className="gap-2">
            {saveMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Settings
          </Button>
        </div>
      )}
    </div>
  );
}