import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Trash2, Flame, AlertTriangle, BatteryLow, Radio, Plus, Zap, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import MobileSelect from '@/components/ui/MobileSelect';
import { useToast } from '@/components/ui/use-toast';
import { formatDistanceToNow } from 'date-fns';
import 'leaflet/dist/leaflet.css';

const FILL_COLORS = { ok: '#22c55e', warning: '#eab308', full: '#f97316', overflow: '#ef4444' };
const STATUS_BADGE = {
  ok: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  full: 'bg-orange-100 text-orange-700',
  overflow: 'bg-red-100 text-red-700',
};
const DEFAULT_CENTER = [0.3476, 32.5825];
const FRACTIONS = ['mixed', 'plastic', 'paper', 'glass', 'metal', 'organic', 'bio', 'hazardous'];

const emptyBin = { bin_code: '', sensor_id: '', waste_fraction: 'mixed', capacity_liters: 1100, collection_threshold_pct: 80, latitude: '', longitude: '' };

export default function SmartBins() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState('all');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyBin);

  const { data: bins = [], isLoading } = useQuery({
    queryKey: ['smart-bins'],
    queryFn: () => base44.entities.SmartBin.list('-fill_level_pct', 500),
    staleTime: 30_000,
  });

  const createBin = useMutation({
    mutationFn: (payload) => base44.entities.SmartBin.create({
      ...payload,
      tenant_id: user?.tenant_id || 'default',
      capacity_liters: Number(payload.capacity_liters) || 1100,
      collection_threshold_pct: Number(payload.collection_threshold_pct) || 80,
      latitude: payload.latitude !== '' ? Number(payload.latitude) : undefined,
      longitude: payload.longitude !== '' ? Number(payload.longitude) : undefined,
      fill_level_pct: 0,
      fill_status: 'ok',
      status: 'active',
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['smart-bins'] }); setOpen(false); setForm(emptyBin); toast({ title: 'Smart bin registered' }); },
    onError: (e) => toast({ title: 'Could not register bin', description: e.message, variant: 'destructive' }),
  });

  const generateCollection = useMutation({
    mutationFn: () => base44.functions.invoke('generateFillDrivenCollection', { horizon_hours: 24 }),
    onSuccess: (res) => {
      const data = res?.data || res;
      qc.invalidateQueries({ queryKey: ['smart-bins'] });
      toast({ title: 'Fill-driven collection', description: data?.summary || `${data?.jobs_created || 0} job(s) created.` });
    },
    onError: (e) => toast({ title: 'Generation failed', description: e.message, variant: 'destructive' }),
  });

  const filtered = statusFilter === 'all' ? bins : bins.filter(b => b.fill_status === statusFilter);
  const located = filtered.filter(b => b.latitude != null && b.longitude != null);
  const center = located[0] ? [located[0].latitude, located[0].longitude] : DEFAULT_CENTER;

  const dueCount = bins.filter(b => (b.fill_level_pct || 0) >= (b.collection_threshold_pct || 80)).length;
  const overflowCount = bins.filter(b => b.fill_status === 'overflow').length;
  const alarmCount = bins.filter(b => b.fire_alarm || b.tilt_alarm).length;
  const lowBattery = bins.filter(b => typeof b.battery_pct === 'number' && b.battery_pct < 20).length;
  const avgFill = bins.length ? Math.round(bins.reduce((s, b) => s + (b.fill_level_pct || 0), 0) / bins.length) : 0;

  const stats = [
    { label: 'Monitored Bins', value: bins.length, color: 'text-primary', icon: Radio },
    { label: 'Due for Collection', value: dueCount, color: 'text-orange-600', icon: Trash2 },
    { label: 'Overflowing', value: overflowCount, color: 'text-red-600', icon: AlertTriangle },
    { label: 'Avg Fill', value: `${avgFill}%`, color: 'text-purple-600', icon: Zap },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-jakarta flex items-center gap-2">
            <Radio className="w-6 h-6 text-primary" /> Smart Bins
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Live fill-level monitoring · demand-based collection · sensor alarms</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4" /> Register Bin
          </Button>
          <Button size="sm" className="gap-2" onClick={() => generateCollection.mutate()} disabled={generateCollection.isPending}>
            <Zap className="w-4 h-4" /> {generateCollection.isPending ? 'Generating…' : 'Generate Collection'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(s => (
          <Card key={s.label} className="border-border/60">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className={`text-xl font-bold font-jakarta ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
                <s.icon className={`w-5 h-5 ${s.color} opacity-50`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {(overflowCount > 0 || alarmCount > 0 || lowBattery > 0) && (
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="pt-3 pb-3 flex flex-wrap items-center gap-4 text-sm">
            {overflowCount > 0 && <span className="flex items-center gap-1.5 text-red-700"><AlertTriangle className="w-4 h-4" /> {overflowCount} overflowing</span>}
            {alarmCount > 0 && <span className="flex items-center gap-1.5 text-orange-700"><Flame className="w-4 h-4" /> {alarmCount} fire/tilt alarm(s)</span>}
            {lowBattery > 0 && <span className="flex items-center gap-1.5 text-yellow-700"><BatteryLow className="w-4 h-4" /> {lowBattery} low battery</span>}
          </CardContent>
        </Card>
      )}

      {located.length > 0 && (
        <Card className="border-border/60 overflow-hidden">
          <div style={{ height: 280 }}>
            <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
              <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {located.map(b => (
                <CircleMarker
                  key={b.id}
                  center={[b.latitude, b.longitude]}
                  radius={8}
                  pathOptions={{ color: FILL_COLORS[b.fill_status] || '#22c55e', fillColor: FILL_COLORS[b.fill_status] || '#22c55e', fillOpacity: 0.7 }}
                >
                  <Popup>
                    <div className="text-sm font-medium">{b.bin_code}</div>
                    <div className="text-xs">{Math.round(b.fill_level_pct || 0)}% full · {b.waste_fraction}</div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        </Card>
      )}

      <div className="flex gap-3 flex-wrap items-center">
        <div className="w-44">
          <MobileSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'ok', label: 'OK' },
              { value: 'warning', label: 'Warning' },
              { value: 'full', label: 'Full' },
              { value: 'overflow', label: 'Overflow' },
            ]}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Radio className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No smart bins yet. Register one to start monitoring fill levels.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Bin</th>
                <th className="pb-2 font-medium">Fraction</th>
                <th className="pb-2 font-medium">Fill</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Battery</th>
                <th className="pb-2 font-medium">Alarms</th>
                <th className="pb-2 font-medium">Predicted Full</th>
                <th className="pb-2 font-medium">Last Reading</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => (
                <tr key={b.id} className={`border-b border-border/30 hover:bg-muted/30 ${b.fill_status === 'overflow' ? 'bg-red-50/30' : ''}`}>
                  <td className="py-2 text-xs font-medium">{b.bin_code}{b.sensor_id ? <span className="block text-[10px] text-muted-foreground font-mono">{b.sensor_id}</span> : null}</td>
                  <td className="py-2 text-xs capitalize">{b.waste_fraction}</td>
                  <td className="py-2 w-32">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, b.fill_level_pct || 0)}%`, background: FILL_COLORS[b.fill_status] || '#22c55e' }} />
                      </div>
                      <span className="text-xs tabular-nums">{Math.round(b.fill_level_pct || 0)}%</span>
                    </div>
                  </td>
                  <td className="py-2"><Badge className={`text-[10px] px-1.5 py-0 ${STATUS_BADGE[b.fill_status] || ''}`} variant="secondary">{b.fill_status}</Badge></td>
                  <td className="py-2 text-xs">{typeof b.battery_pct === 'number' ? `${Math.round(b.battery_pct)}%` : '—'}</td>
                  <td className="py-2">
                    <div className="flex gap-1">
                      {b.fire_alarm && <Flame className="w-3.5 h-3.5 text-red-500" />}
                      {b.tilt_alarm && <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />}
                      {!b.fire_alarm && !b.tilt_alarm && <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                  </td>
                  <td className="py-2 text-xs text-muted-foreground">{b.predicted_full_at ? formatDistanceToNow(new Date(b.predicted_full_at), { addSuffix: true }) : '—'}</td>
                  <td className="py-2 text-xs text-muted-foreground">{b.last_reading_at ? formatDistanceToNow(new Date(b.last_reading_at), { addSuffix: true }) : 'never'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-jakarta flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> Register Smart Bin</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Bin Code *"><input className="w-full border border-input bg-background rounded-lg px-3 py-2 text-sm" value={form.bin_code} onChange={e => setForm(f => ({ ...f, bin_code: e.target.value }))} placeholder="e.g. KLA-0142" /></Field>
            <Field label="Sensor ID"><input className="w-full border border-input bg-background rounded-lg px-3 py-2 text-sm" value={form.sensor_id} onChange={e => setForm(f => ({ ...f, sensor_id: e.target.value }))} placeholder="Hardware id" /></Field>
            <Field label="Waste Fraction">
              <MobileSelect value={form.waste_fraction} onChange={v => setForm(f => ({ ...f, waste_fraction: v }))} options={FRACTIONS.map(x => ({ value: x, label: x }))} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Capacity (L)"><input type="number" className="w-full border border-input bg-background rounded-lg px-3 py-2 text-sm" value={form.capacity_liters} onChange={e => setForm(f => ({ ...f, capacity_liters: e.target.value }))} /></Field>
              <Field label="Threshold (%)"><input type="number" className="w-full border border-input bg-background rounded-lg px-3 py-2 text-sm" value={form.collection_threshold_pct} onChange={e => setForm(f => ({ ...f, collection_threshold_pct: e.target.value }))} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Latitude"><input className="w-full border border-input bg-background rounded-lg px-3 py-2 text-sm" value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} placeholder="0.3476" /></Field>
              <Field label="Longitude"><input className="w-full border border-input bg-background rounded-lg px-3 py-2 text-sm" value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} placeholder="32.5825" /></Field>
            </div>
            <Button className="w-full" disabled={!form.bin_code || createBin.isPending} onClick={() => createBin.mutate(form)}>
              {createBin.isPending ? 'Saving…' : 'Register Bin'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}
