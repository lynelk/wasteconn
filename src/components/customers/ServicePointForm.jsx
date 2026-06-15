import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Navigation, Clock } from 'lucide-react';

export default function ServicePointForm({ servicePoint, customerId, onClose }) {
  const qc = useQueryClient();
  const { data: zones = [] } = useQuery({ queryKey: ['zones'], queryFn: () => base44.entities.ServiceZone.list() });

  const [form, setForm] = useState({
    customer_id: servicePoint?.customer_id || customerId || '',
    name: servicePoint?.name || '',
    address: servicePoint?.address || '',
    latitude: servicePoint?.latitude || '',
    longitude: servicePoint?.longitude || '',
    landmark: servicePoint?.landmark || '',
    zone_id: servicePoint?.zone_id || '',
    pin_method: servicePoint?.pin_method || 'gps_manual',
    status: servicePoint?.status || 'active',
    notes: servicePoint?.notes || '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const captureGPS = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => {
        set('latitude', pos.coords.latitude);
        set('longitude', pos.coords.longitude);
        setForm(f => ({ ...f, latitude: pos.coords.latitude, longitude: pos.coords.longitude, pin_method: 'gps_auto' }));
      },
      () => {},
      { enableHighAccuracy: true }
    );
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const data = { ...form };
      if (servicePoint?.id) {
        // Build change history entry
        const changes = [];
        const now = new Date().toISOString();
        for (const key of ['address', 'latitude', 'longitude', 'zone_id', 'landmark']) {
          if (String(data[key]) !== String(servicePoint[key] || '')) {
            changes.push({
              changed_at: now,
              changed_by: 'current_user',
              field: key,
              old_value: String(servicePoint[key] || ''),
              new_value: String(data[key]),
            });
          }
        }
        const existingHistory = servicePoint.change_history || [];
        data.change_history = [...existingHistory, ...changes];
        return base44.entities.ServicePoint.update(servicePoint.id, data);
      }
      return base44.entities.ServicePoint.create(data);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['servicePoints'] }); onClose(); },
  });

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1.5">
          <Label>Service Point Name *</Label>
          <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Main Gate, Branch A" />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Address *</Label>
          <Input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Full street address" />
        </div>

        {/* GPS Section */}
        <div className="col-span-2 bg-secondary/50 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> GPS Coordinates</Label>
            <Button variant="outline" size="sm" onClick={captureGPS} className="gap-1 text-xs">
              <Navigation className="w-3 h-3" /> Auto-Capture
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Latitude</Label>
              <Input type="number" step="any" value={form.latitude} onChange={e => set('latitude', parseFloat(e.target.value) || '')} placeholder="0.3163" />
            </div>
            <div>
              <Label className="text-xs">Longitude</Label>
              <Input type="number" step="any" value={form.longitude} onChange={e => set('longitude', parseFloat(e.target.value) || '')} placeholder="32.5811" />
            </div>
          </div>
          {form.latitude && form.longitude && (
            <div className="text-xs text-muted-foreground">
              Pin method: <span className="capitalize text-primary">{form.pin_method.replace('_', ' ')}</span>
            </div>
          )}
        </div>

        <div className="col-span-2 space-y-1.5">
          <Label>Landmark</Label>
          <Input value={form.landmark} onChange={e => set('landmark', e.target.value)} placeholder="Near the yellow church..." />
        </div>

        <div className="space-y-1.5">
          <Label>Service Zone</Label>
          <Select value={form.zone_id} onValueChange={v => set('zone_id', v)}>
            <SelectTrigger><SelectValue placeholder="Assign zone" /></SelectTrigger>
            <SelectContent>{zones.map(z => <SelectItem key={z.id} value={z.id}>{z.zone_name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={v => set('status', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="pending_approval">Pending Approval</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2 space-y-1.5">
          <Label>Notes</Label>
          <Textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
      </div>

      {/* Change History */}
      {servicePoint?.change_history?.length > 0 && (
        <div className="border rounded-xl p-3 space-y-2">
          <Label className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="w-3 h-3" /> Change History</Label>
          {servicePoint.change_history.slice(-5).reverse().map((ch, i) => (
            <div key={i} className="text-xs text-muted-foreground border-l-2 border-primary/20 pl-2">
              <span className="font-medium text-foreground">{ch.field}</span>: {ch.old_value} → {ch.new_value}
              <span className="ml-2 text-muted-foreground/70">{ch.changed_at?.slice(0,10)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.address}>
          {mutation.isPending ? 'Saving...' : servicePoint ? 'Update Service Point' : 'Add Service Point'}
        </Button>
      </div>
    </div>
  );
}