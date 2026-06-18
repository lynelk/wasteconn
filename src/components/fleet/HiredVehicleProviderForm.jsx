import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';
import MobileSelect from '@/components/ui/MobileSelect';

export default function HiredVehicleProviderForm({ provider, onClose }) {
  const qc = useQueryClient();
  const { data: tenants = [] } = useQuery({ queryKey: ['tenants'], queryFn: () => base44.entities.Tenant.list() });

  const [form, setForm] = useState({
    tenant_id: provider?.tenant_id || tenants[0]?.id || '',
    provider_code: provider?.provider_code || '',
    client_name: provider?.client_name || '',
    contact_person: provider?.contact_person || '',
    phone: provider?.phone || '',
    email: provider?.email || '',
    vehicle_type: provider?.vehicle_type || 'truck',
    capacity: provider?.capacity || '',
    rate_per_trip_ugx: provider?.rate_per_trip_ugx || '',
    rate_per_day_ugx: provider?.rate_per_day_ugx || '',
    availability: provider?.availability || 'on_call',
    mou_status: provider?.mou_status || 'No MOU',
    status: provider?.status || 'active',
    notes: provider?.notes || '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: () => provider
      ? base44.entities.HiredVehicleProvider.update(provider.id, form)
      : base44.entities.HiredVehicleProvider.create({ ...form, tenant_id: form.tenant_id || tenants[0]?.id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hired-providers'] }); onClose(); },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold font-jakarta text-lg">{provider ? 'Edit Provider' : 'Add Hired Vehicle Provider'}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Provider Code</Label>
            <Input value={form.provider_code} onChange={e => set('provider_code', e.target.value)} placeholder="e.g. HV-001" />
          </div>
          <div className="space-y-1.5">
            <Label>Company Name *</Label>
            <Input value={form.client_name} onChange={e => set('client_name', e.target.value)} placeholder="Transport company name" />
          </div>
          <div className="space-y-1.5">
            <Label>Contact Person</Label>
            <Input value={form.contact_person} onChange={e => set('contact_person', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+256..." />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Vehicle Type</Label>
            <MobileSelect value={form.vehicle_type} onChange={v => set('vehicle_type', v)} options={[
              {value:'truck',label:'Truck'},{value:'tipper',label:'Tipper'},
              {value:'compactor',label:'Compactor'},{value:'pickup',label:'Pickup'},
              {value:'tricycle',label:'Tricycle'},{value:'other',label:'Other'},
            ]} />
          </div>
          <div className="space-y-1.5">
            <Label>Capacity</Label>
            <Input value={form.capacity} onChange={e => set('capacity', e.target.value)} placeholder="e.g. 5 tonnes" />
          </div>
          <div className="space-y-1.5">
            <Label>Rate per Trip (UGX)</Label>
            <Input type="number" value={form.rate_per_trip_ugx} onChange={e => set('rate_per_trip_ugx', Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>Rate per Day (UGX)</Label>
            <Input type="number" value={form.rate_per_day_ugx} onChange={e => set('rate_per_day_ugx', Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>Availability</Label>
            <MobileSelect value={form.availability} onChange={v => set('availability', v)} options={[
              {value:'on_call',label:'On Call'},{value:'weekdays',label:'Weekdays'},
              {value:'weekends',label:'Weekends'},{value:'always',label:'Always'},
            ]} />
          </div>
          <div className="space-y-1.5">
            <Label>MOU Status</Label>
            <MobileSelect value={form.mou_status} onChange={v => set('mou_status', v)} options={[
              {value:'MOU Signed',label:'MOU Signed'},{value:'No MOU',label:'No MOU'},{value:'Pending',label:'Pending'},
            ]} />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <MobileSelect value={form.status} onChange={v => set('status', v)} options={[
              {value:'active',label:'Active'},{value:'inactive',label:'Inactive'},{value:'blacklisted',label:'Blacklisted'},
            ]} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Notes</Label>
            <textarea
              className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background resize-none"
              rows={2}
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.client_name}>
            {mutation.isPending ? 'Saving...' : provider ? 'Save Changes' : 'Add Provider'}
          </Button>
        </div>
      </div>
    </div>
  );
}