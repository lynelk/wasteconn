import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import MobileSelect from '@/components/ui/MobileSelect';
import { Textarea } from '@/components/ui/textarea';
import EntitySelect from '@/components/common/EntitySelect';

export default function PickupForm({ pickup, onClose }) {
  const qc = useQueryClient();

  const [form, setForm] = useState({
    customer_id: pickup?.customer_id || '',
    tenant_id: pickup?.tenant_id || '',
    request_type: pickup?.request_type || 'on_demand',
    waste_type: pickup?.waste_type || 'general',
    scheduled_date: pickup?.scheduled_date || '',
    scheduled_time: pickup?.scheduled_time || '',
    address: pickup?.address || '',
    notes: pickup?.notes || '',
    status: pickup?.status || 'pending',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCustomerChange = (customerId, c) => {
    if (c) {
      setForm(f => ({ ...f, customer_id: customerId, tenant_id: c.tenant_id, address: c.address || f.address }));
    } else {
      set('customer_id', customerId);
    }
  };

  const mutation = useMutation({
    mutationFn: () => pickup
      ? base44.entities.PickupRequest.update(pickup.id, form)
      : base44.entities.PickupRequest.create(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pickups'] }); onClose(); },
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1.5">
          <Label>Customer *</Label>
          <EntitySelect entity="Customer" value={form.customer_id} onChange={handleCustomerChange} searchFields={['full_name', 'phone']} getLabel={(c) => `${c.full_name} — ${c.phone}`} placeholder="Select customer" />
        </div>
        <div className="space-y-1.5">
          <Label>Request Type</Label>
          <MobileSelect value={form.request_type} onChange={v => set('request_type', v)} options={[{value:'on_demand',label:'On Demand'},{value:'scheduled',label:'Scheduled'},{value:'bulk',label:'Bulk'}]} />
        </div>
        <div className="space-y-1.5">
          <Label>Waste Type</Label>
          <MobileSelect value={form.waste_type} onChange={v => set('waste_type', v)} options={[{value:'general',label:'General'},{value:'recyclable',label:'Recyclable'},{value:'organic',label:'Organic'},{value:'hazardous',label:'Hazardous'},{value:'bulky',label:'Bulky'}]} />
        </div>
        <div className="space-y-1.5">
          <Label>Scheduled Date</Label>
          <Input type="date" value={form.scheduled_date} onChange={e => set('scheduled_date', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Scheduled Time</Label>
          <Input type="time" value={form.scheduled_time} onChange={e => set('scheduled_time', e.target.value)} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Pickup Address</Label>
          <Input value={form.address} onChange={e => set('address', e.target.value)} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Notes</Label>
          <Textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
        {pickup && (
          <div className="col-span-2 space-y-1.5">
            <Label>Status</Label>
            <MobileSelect value={form.status} onChange={v => set('status', v)} options={[{value:'pending',label:'Pending'},{value:'assigned',label:'Assigned'},{value:'in_progress',label:'In Progress'},{value:'completed',label:'Completed'},{value:'cancelled',label:'Cancelled'}]} />
          </div>
        )}
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.customer_id}>
          {mutation.isPending ? 'Saving...' : pickup ? 'Save Changes' : 'Create Request'}
        </Button>
      </div>
    </div>
  );
}