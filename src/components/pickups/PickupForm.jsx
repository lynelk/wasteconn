import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export default function PickupForm({ pickup, onClose }) {
  const qc = useQueryClient();
  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: () => base44.entities.Customer.list() });

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

  const handleCustomerChange = (customerId) => {
    const c = customers.find(c => c.id === customerId);
    set('customer_id', customerId);
    if (c) {
      setForm(f => ({ ...f, customer_id: customerId, tenant_id: c.tenant_id, address: c.address || f.address }));
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
          <Select value={form.customer_id} onValueChange={handleCustomerChange}>
            <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
            <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name} — {c.phone}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Request Type</Label>
          <Select value={form.request_type} onValueChange={v => set('request_type', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="on_demand">On Demand</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="bulk">Bulk</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Waste Type</Label>
          <Select value={form.waste_type} onValueChange={v => set('waste_type', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="recyclable">Recyclable</SelectItem>
              <SelectItem value="organic">Organic</SelectItem>
              <SelectItem value="hazardous">Hazardous</SelectItem>
              <SelectItem value="bulky">Bulky</SelectItem>
            </SelectContent>
          </Select>
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
            <Select value={form.status} onValueChange={v => set('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
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