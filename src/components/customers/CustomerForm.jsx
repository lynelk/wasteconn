import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const UGANDA_DISTRICTS = ['Kampala','Wakiso','Mukono','Jinja','Mbarara','Gulu','Lira','Arua','Fort Portal','Mbale','Soroti','Masaka'];

export default function CustomerForm({ customer, onClose }) {
  const qc = useQueryClient();

  const { data: zones = [] } = useQuery({ queryKey: ['zones'], queryFn: () => base44.entities.ServiceZone.list() });
  const { data: tenants = [] } = useQuery({ queryKey: ['tenants'], queryFn: () => base44.entities.Tenant.list() });

  const [form, setForm] = useState({
    full_name: customer?.full_name || '',
    phone: customer?.phone || '',
    email: customer?.email || '',
    customer_type: customer?.customer_type || 'residential',
    address: customer?.address || '',
    district: customer?.district || '',
    zone_id: customer?.zone_id || '',
    tenant_id: customer?.tenant_id || (tenants[0]?.id || ''),
    status: customer?.status || 'active',
    mobile_money_number: customer?.mobile_money_number || '',
    mobile_money_provider: customer?.mobile_money_provider || 'none',
    preferred_language: customer?.preferred_language || 'english',
    notes: customer?.notes || '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: () => customer
      ? base44.entities.Customer.update(customer.id, form)
      : base44.entities.Customer.create(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); onClose(); },
  });

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1.5">
          <Label>Full Name *</Label>
          <Input value={form.full_name} onChange={e => set('full_name', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Phone *</Label>
          <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+256..." />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Customer Type</Label>
          <Select value={form.customer_type} onValueChange={v => set('customer_type', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="residential">Residential</SelectItem>
              <SelectItem value="commercial">Commercial</SelectItem>
              <SelectItem value="industrial">Industrial</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>District</Label>
          <Select value={form.district} onValueChange={v => set('district', v)}>
            <SelectTrigger><SelectValue placeholder="Select district" /></SelectTrigger>
            <SelectContent>{UGANDA_DISTRICTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Address</Label>
          <Input value={form.address} onChange={e => set('address', e.target.value)} />
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
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Mobile Money Provider</Label>
          <Select value={form.mobile_money_provider} onValueChange={v => set('mobile_money_provider', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="mtn">MTN MoMo</SelectItem>
              <SelectItem value="airtel">Airtel Money</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Mobile Money Number</Label>
          <Input value={form.mobile_money_number} onChange={e => set('mobile_money_number', e.target.value)} placeholder="+256..." />
        </div>
        <div className="space-y-1.5">
          <Label>Preferred Language</Label>
          <Select value={form.preferred_language} onValueChange={v => set('preferred_language', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="english">English</SelectItem>
              <SelectItem value="luganda">Luganda</SelectItem>
              <SelectItem value="swahili">Swahili</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Notes</Label>
          <Textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.full_name || !form.phone}>
          {mutation.isPending ? 'Saving...' : customer ? 'Save Changes' : 'Register Customer'}
        </Button>
      </div>
    </div>
  );
}