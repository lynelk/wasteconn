import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import UgandaLocationPicker from './UgandaLocationPicker';
import { MapPin } from 'lucide-react';

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];

export default function ZoneForm({ zone, onClose }) {
  const qc = useQueryClient();
  const { data: tenants = [] } = useQuery({ queryKey: ['tenants'], queryFn: () => base44.entities.Tenant.list() });

  const [form, setForm] = useState({
    zone_name: zone?.zone_name || '',
    zone_code: zone?.zone_code || '',
    district: zone?.district || '',
    sub_county: zone?.sub_county || '',
    parish: zone?.parish || '',
    village: zone?.village || '',
    collection_days: zone?.collection_days || [],
    collection_time: zone?.collection_time || '',
    tenant_id: zone?.tenant_id || (tenants[0]?.id || ''),
    status: zone?.status || 'active',
    max_customers: zone?.max_customers || '',
    notes: zone?.notes || '',
  });

  // Uganda location state
  const [location, setLocation] = useState({
    region: zone?.region || '',
    district: zone?.district || '',
    county: zone?.county || '',
    subcounty: zone?.sub_county || '',
    parish: zone?.parish || '',
    village: zone?.village || '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleLocationChange = (loc) => {
    setLocation(loc);
    // Sync location fields into form
    setForm(f => ({
      ...f,
      region: loc.region || '',
      district: loc.district || '',
      county: loc.county || '',
      sub_county: loc.subcounty || '',
      parish: loc.parish || '',
      village: loc.village || '',
    }));
  };

  const toggleDay = (day) => {
    setForm(f => ({
      ...f,
      collection_days: f.collection_days.includes(day)
        ? f.collection_days.filter(d => d !== day)
        : [...f.collection_days, day]
    }));
  };

  const mutation = useMutation({
    mutationFn: () => zone
      ? base44.entities.ServiceZone.update(zone.id, form)
      : base44.entities.ServiceZone.create(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['zones'] }); onClose(); },
  });

  return (
    <div className="space-y-5">
      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1.5">
          <Label>Zone Name *</Label>
          <Input value={form.zone_name} onChange={e => set('zone_name', e.target.value)} placeholder="e.g. Kampala North Zone A" />
        </div>
        <div className="space-y-1.5">
          <Label>Zone Code</Label>
          <Input value={form.zone_code} onChange={e => set('zone_code', e.target.value)} placeholder="e.g. KLA-N-01" />
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={v => set('status', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Uganda Administrative Location */}
      <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Administrative Location</span>
          <span className="text-xs text-muted-foreground">(Uganda Official Hierarchy)</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <UgandaLocationPicker
            value={location}
            onChange={handleLocationChange}
            levels={['region', 'district', 'county', 'subcounty', 'parish', 'village']}
            required={['region', 'district']}
          />
        </div>
      </div>

      {/* Collection Schedule */}
      <div className="space-y-2">
        <Label>Collection Days</Label>
        <div className="flex flex-wrap gap-3">
          {DAYS.map(day => (
            <div key={day} className="flex items-center gap-2">
              <Checkbox checked={form.collection_days.includes(day)} onCheckedChange={() => toggleDay(day)} id={day} />
              <label htmlFor={day} className="text-sm capitalize cursor-pointer">{day.slice(0,3)}</label>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Collection Time</Label>
          <Input value={form.collection_time} onChange={e => set('collection_time', e.target.value)} placeholder="e.g. 07:00 - 10:00" />
        </div>
        <div className="space-y-1.5">
          <Label>Max Customers</Label>
          <Input type="number" value={form.max_customers} onChange={e => set('max_customers', Number(e.target.value))} />
        </div>
      </div>

      {tenants.length > 1 && (
        <div className="space-y-1.5">
          <Label>Tenant</Label>
          <Select value={form.tenant_id} onValueChange={v => set('tenant_id', v)}>
            <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
            <SelectContent>{tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.company_name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.zone_name || !location.district}>
          {mutation.isPending ? 'Saving...' : zone ? 'Save Changes' : 'Create Zone'}
        </Button>
      </div>
    </div>
  );
}