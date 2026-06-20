import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Cpu, Plus, Wifi, WifiOff, AlertCircle, Loader2, Search } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

const DEVICE_TYPE_LABELS = {
  ultrasonic_bin: 'Ultrasonic Bin',
  gps_vehicle: 'GPS Vehicle',
  weigh_cell: 'Weigh Cell',
  temperature: 'Temperature'
};

function getStatusHealth(lastSeen) {
  if (!lastSeen) return 'red';
  const elapsed = Date.now() - new Date(lastSeen).getTime();
  const hours = elapsed / (1000 * 60 * 60);
  if (hours <= 1) return 'green';
  if (hours <= 4) return 'amber';
  return 'red';
}

const HEALTH_CONFIG = {
  green: { label: 'Online', badge: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  amber: { label: 'Stale', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  red: { label: 'Offline', badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' }
};

function RegisterDeviceForm({ onClose, onSaved }) {
  const [form, setForm] = useState({
    device_id: '', device_type: 'ultrasonic_bin', binding_type: 'container',
    binding_id: '', firmware_version: '', secret_hash: '', tenant_id: 'default', status: 'online'
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.device_id || !form.device_type) return toast.error('Device ID and type required');
    setSaving(true);
    try {
      await base44.entities.IoTDevice.create(form);
      toast.success('Device registered');
      onSaved();
      onClose();
    } catch (e) {
      toast.error('Failed to register device');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Device ID *</Label>
          <Input value={form.device_id} onChange={e => setForm(f => ({ ...f, device_id: e.target.value }))} placeholder="e.g. BIN-KLA-001" />
        </div>
        <div>
          <Label>Device Type *</Label>
          <Select value={form.device_type} onValueChange={v => setForm(f => ({ ...f, device_type: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(DEVICE_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Binding Type</Label>
          <Select value={form.binding_type} onValueChange={v => setForm(f => ({ ...f, binding_type: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="container">Container</SelectItem>
              <SelectItem value="vehicle">Vehicle</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Binding ID</Label>
          <Input value={form.binding_id} onChange={e => setForm(f => ({ ...f, binding_id: e.target.value }))} placeholder="Container or Vehicle ID" />
        </div>
        <div>
          <Label>Firmware Version</Label>
          <Input value={form.firmware_version} onChange={e => setForm(f => ({ ...f, firmware_version: e.target.value }))} placeholder="e.g. v1.2.3" />
        </div>
        <div>
          <Label>Device Secret</Label>
          <Input value={form.secret_hash} onChange={e => setForm(f => ({ ...f, secret_hash: e.target.value }))} placeholder="Shared secret key" />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
          Register Device
        </Button>
      </div>
    </div>
  );
}

export default function DeviceManagement() {
  const { user } = useAuth();
  const [showRegister, setShowRegister] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');

  const { data: devices = [], isLoading, refetch } = useQuery({
    queryKey: ['iot-devices'],
    queryFn: () => base44.entities.IoTDevice.list('-last_seen', 200),
    refetchInterval: 60000
  });

  if (!['admin', 'super_admin'].includes(user?.role)) {
    return <div className="p-8 text-center text-muted-foreground">Access restricted to administrators.</div>;
  }

  const filtered = devices.filter(d => {
    const matchSearch = !search || d.device_id.toLowerCase().includes(search.toLowerCase()) || (d.binding_id || '').toLowerCase().includes(search.toLowerCase());
    const health = getStatusHealth(d.last_seen);
    const matchStatus = !filterStatus || health === filterStatus;
    const matchType = !filterType || d.device_type === filterType;
    return matchSearch && matchStatus && matchType;
  });

  const counts = { green: 0, amber: 0, red: 0 };
  devices.forEach(d => { const h = getStatusHealth(d.last_seen); counts[h]++; });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-jakarta">Device Management</h1>
          <p className="text-muted-foreground text-sm mt-1">IoT device registry — bins, GPS trackers, weigh cells</p>
        </div>
        <Button onClick={() => setShowRegister(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Register Device
        </Button>
      </div>

      {/* Health Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-l-4 border-green-500">
          <CardContent className="p-4 flex items-center gap-3">
            <Wifi className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-2xl font-bold">{counts.green}</p>
              <p className="text-xs text-muted-foreground">Online (last 1h)</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-amber-500">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <div>
              <p className="text-2xl font-bold">{counts.amber}</p>
              <p className="text-xs text-muted-foreground">Stale (1–4h)</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-red-500">
          <CardContent className="p-4 flex items-center gap-3">
            <WifiOff className="w-5 h-5 text-red-600" />
            <div>
              <p className="text-2xl font-bold">{counts.red}</p>
              <p className="text-xs text-muted-foreground">Offline (&gt;4h)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search device ID or binding..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>All types</SelectItem>
            {Object.entries(DEVICE_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-32"><SelectValue placeholder="All status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>All</SelectItem>
            <SelectItem value="green">Online</SelectItem>
            <SelectItem value="amber">Stale</SelectItem>
            <SelectItem value="red">Offline</SelectItem>
          </SelectContent>
        </Select>
        {(search || filterStatus || filterType) && (
          <Button variant="ghost" onClick={() => { setSearch(''); setFilterStatus(''); setFilterType(''); }}>Clear</Button>
        )}
      </div>

      {/* Device Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Cpu className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>{devices.length === 0 ? 'No devices registered yet.' : 'No devices match the current filters.'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Device ID</th>
                    <th className="text-left px-4 py-3 font-medium">Type</th>
                    <th className="text-left px-4 py-3 font-medium">Bound To</th>
                    <th className="text-left px-4 py-3 font-medium">Firmware</th>
                    <th className="text-left px-4 py-3 font-medium">Last Seen</th>
                    <th className="text-left px-4 py-3 font-medium">Health</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(d => {
                    const health = getStatusHealth(d.last_seen);
                    const cfg = HEALTH_CONFIG[health];
                    return (
                      <tr key={d.id} className="border-t hover:bg-muted/20">
                        <td className="px-4 py-3 font-mono font-medium">{d.device_id}</td>
                        <td className="px-4 py-3 text-muted-foreground">{DEVICE_TYPE_LABELS[d.device_type] || d.device_type}</td>
                        <td className="px-4 py-3">
                          {d.binding_id ? (
                            <span className="text-xs bg-secondary px-2 py-0.5 rounded font-mono">
                              {d.binding_type}: {d.binding_id.slice(0, 12)}…
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{d.firmware_version || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {d.last_seen ? formatDistanceToNow(new Date(d.last_seen), { addSuffix: true }) : 'Never'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                            {cfg.label}
                          </span>
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

      <Dialog open={showRegister} onOpenChange={setShowRegister}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Register New Device</DialogTitle>
          </DialogHeader>
          <RegisterDeviceForm onClose={() => setShowRegister(false)} onSaved={refetch} />
        </DialogContent>
      </Dialog>
    </div>
  );
}