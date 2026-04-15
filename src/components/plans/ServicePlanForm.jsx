import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

export default function ServicePlanForm({ plan, onClose }) {
  const qc = useQueryClient();
  const { data: tenants = [] } = useQuery({ queryKey: ['tenants'], queryFn: () => base44.entities.Tenant.list() });

  const [form, setForm] = useState({
    plan_name: plan?.plan_name || '',
    description: plan?.description || '',
    customer_type: plan?.customer_type || 'all',
    frequency: plan?.frequency || 'weekly',
    price_ugx: plan?.price_ugx || '',
    billing_cycle: plan?.billing_cycle || 'monthly',
    includes_recycling: plan?.includes_recycling || false,
    max_bins: plan?.max_bins || 1,
    status: plan?.status || 'active',
    tenant_id: plan?.tenant_id || (tenants[0]?.id || ''),
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: () => plan
      ? base44.entities.ServicePlan.update(plan.id, form)
      : base44.entities.ServicePlan.create({ ...form, price_ugx: Number(form.price_ugx) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['plans'] }); onClose(); },
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1.5">
          <Label>Plan Name *</Label>
          <Input value={form.plan_name} onChange={e => set('plan_name', e.target.value)} placeholder="e.g. Residential Standard" />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Description</Label>
          <Textarea rows={2} value={form.description} onChange={e => set('description', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Price (UGX) *</Label>
          <Input type="number" value={form.price_ugx} onChange={e => set('price_ugx', e.target.value)} placeholder="e.g. 50000" />
        </div>
        <div className="space-y-1.5">
          <Label>Billing Cycle</Label>
          <Select value={form.billing_cycle} onValueChange={v => set('billing_cycle', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="annually">Annually</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Collection Frequency</Label>
          <Select value={form.frequency} onValueChange={v => set('frequency', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="twice_weekly">Twice Weekly</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="biweekly">Bi-weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Customer Type</Label>
          <Select value={form.customer_type} onValueChange={v => set('customer_type', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="residential">Residential</SelectItem>
              <SelectItem value="commercial">Commercial</SelectItem>
              <SelectItem value="industrial">Industrial</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Max Bins</Label>
          <Input type="number" min={1} value={form.max_bins} onChange={e => set('max_bins', Number(e.target.value))} />
        </div>
        <div className="flex items-center gap-3 col-span-2">
          <Switch checked={form.includes_recycling} onCheckedChange={v => set('includes_recycling', v)} />
          <Label>Includes Recycling Collection</Label>
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.plan_name || !form.price_ugx}>
          {mutation.isPending ? 'Saving...' : plan ? 'Save Changes' : 'Create Plan'}
        </Button>
      </div>
    </div>
  );
}