import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CATEGORIES = ['missed_collection','billing_dispute','service_quality','access_issue','bin_damage','driver_behaviour','wrong_schedule','general_inquiry','other'];
const SOURCES = ['web_form','whatsapp','email','phone','in_app','operator'];
const PRIORITIES = ['low','medium','high','urgent'];

const SLA_MAP = { missed_collection: 12, billing_dispute: 48, service_quality: 24, access_issue: 8, bin_damage: 48, driver_behaviour: 24, wrong_schedule: 12, general_inquiry: 72, other: 48, urgent: 4, high: 8, medium: 24, low: 72 };

export default function TicketForm({ customers = [], zones = [], servicePoints = [], onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    source: 'web_form', category: 'general_inquiry', priority: 'medium',
    customer_id: '', customer_name: '', customer_phone: '', customer_email: '',
    zone_id: '', service_point_id: '', subject: '', description: '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: async (data) => {
      const slaHours = SLA_MAP[data.category] || 24;
      const slaDue = new Date(Date.now() + slaHours * 3600000).toISOString();
      const ticketNumber = `TKT-${Date.now().toString(36).toUpperCase()}`;
      const customer = customers.find(c => c.id === data.customer_id);
      return base44.entities.Ticket.create({
        ...data,
        ticket_number: ticketNumber,
        customer_name: customer?.full_name || data.customer_name,
        customer_phone: customer?.phone || data.customer_phone,
        customer_email: customer?.email || data.customer_email,
        sla_hours: slaHours,
        sla_due_at: slaDue,
        status: 'open',
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tickets'] }); onClose(); },
  });

  const selectedCustomer = customers.find(c => c.id === form.customer_id);
  const customerPoints = servicePoints.filter(sp => sp.customer_id === form.customer_id);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Source *</Label>
          <Select value={form.source} onValueChange={v => set('source', v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{SOURCES.map(s => <SelectItem key={s} value={s}>{s.replace('_',' ')}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Priority</Label>
          <Select value={form.priority} onValueChange={v => set('priority', v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-xs">Category *</Label>
        <Select value={form.category} onValueChange={v => set('category', v)}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g,' ')}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs">Customer (optional)</Label>
        <Select value={form.customer_id || 'anonymous'} onValueChange={v => set('customer_id', v === 'anonymous' ? '' : v)}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Search customer..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="anonymous">Anonymous / Walk-in</SelectItem>
            {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name} · {c.phone}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {!form.customer_id && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Contact Name</Label>
            <Input className="mt-1" value={form.customer_name} onChange={e => set('customer_name', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Phone</Label>
            <Input className="mt-1" value={form.customer_phone} onChange={e => set('customer_phone', e.target.value)} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Zone</Label>
          <Select value={form.zone_id || 'none'} onValueChange={v => set('zone_id', v === 'none' ? '' : v)}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Select zone" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not specified</SelectItem>
              {zones.map(z => <SelectItem key={z.id} value={z.id}>{z.zone_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Service Point</Label>
          <Select value={form.service_point_id || 'none'} onValueChange={v => set('service_point_id', v === 'none' ? '' : v)}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Select service point" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not specified</SelectItem>
              {(form.customer_id ? customerPoints : servicePoints).map(sp => (
                <SelectItem key={sp.id} value={sp.id}>{sp.name || sp.address}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-xs">Subject</Label>
        <Input className="mt-1" value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="Brief summary" />
      </div>

      <div>
        <Label className="text-xs">Description *</Label>
        <Textarea className="mt-1" rows={4} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe the issue in detail..." />
      </div>

      <div className="bg-muted/40 rounded-lg px-3 py-2 text-xs text-muted-foreground">
        SLA: <strong className="text-foreground">{SLA_MAP[form.category] || 24}h resolution target</strong> based on category
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => mutation.mutate(form)} disabled={mutation.isPending || !form.description}>
          {mutation.isPending ? 'Creating...' : 'Create Ticket'}
        </Button>
      </div>
    </div>
  );
}