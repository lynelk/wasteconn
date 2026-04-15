import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export default function ComplaintForm({ onClose, preselectedCustomerId }) {
  const qc = useQueryClient();
  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: () => base44.entities.Customer.list() });

  const [form, setForm] = useState({
    customer_id: preselectedCustomerId || '',
    tenant_id: '',
    category: 'other',
    subject: '',
    description: '',
    priority: 'medium',
    status: 'open',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCustomerChange = (id) => {
    const c = customers.find(c => c.id === id);
    setForm(f => ({ ...f, customer_id: id, tenant_id: c?.tenant_id || '' }));
  };

  const mutation = useMutation({
    mutationFn: () => base44.entities.Complaint.create(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['complaints'] }); onClose(); },
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
          <Label>Category</Label>
          <Select value={form.category} onValueChange={v => set('category', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="missed_collection">Missed Collection</SelectItem>
              <SelectItem value="driver_behaviour">Driver Behaviour</SelectItem>
              <SelectItem value="billing">Billing Issue</SelectItem>
              <SelectItem value="service_quality">Service Quality</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Priority</Label>
          <Select value={form.priority} onValueChange={v => set('priority', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Subject</Label>
          <Input value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="Brief summary..." />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Description *</Label>
          <Textarea rows={3} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe the issue in detail..." />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.customer_id || !form.description}>
          {mutation.isPending ? 'Saving...' : 'Submit Complaint'}
        </Button>
      </div>
    </div>
  );
}