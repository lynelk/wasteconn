import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import MobileSelect from '@/components/ui/MobileSelect';
import { Textarea } from '@/components/ui/textarea';

const UGANDA_DISTRICTS = ['Kampala','Wakiso','Mukono','Jinja','Mbarara','Gulu','Lira','Arua','Fort Portal','Mbale','Soroti','Masaka'];

export default function TenantForm({ tenant, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    company_name: tenant?.company_name || '',
    tenant_type: tenant?.tenant_type || 'operator',
    parent_city_tenant_id: tenant?.parent_city_tenant_id || '',
    contact_email: tenant?.contact_email || '',
    contact_phone: tenant?.contact_phone || '',
    district: tenant?.district || '',
    address: tenant?.address || '',
    registration_number: tenant?.registration_number || '',
    subscription_plan: tenant?.subscription_plan || 'basic',
    status: tenant?.status || 'pending',
    admin_email: tenant?.admin_email || '',
    isolation_enforced: tenant?.isolation_enforced !== false,
    notes: tenant?.notes || '',
  });

  const { data: allTenants = [] } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => base44.entities.Tenant.list(),
  });
  const cityTenants = allTenants.filter(t => t.tenant_type === 'city');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: () => tenant
      ? base44.entities.Tenant.update(tenant.id, form)
      : base44.entities.Tenant.create(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenants'] }); onClose(); },
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1.5">
          <Label>Company Name *</Label>
          <Input value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="e.g. Kampala Clean Ltd" />
        </div>
        <div className="space-y-1.5">
          <Label>Tenant Type *</Label>
          <MobileSelect
            value={form.tenant_type}
            onChange={v => set('tenant_type', v)}
            options={[{ value: 'city', label: '🏛️ City Authority' }, { value: 'operator', label: '🚛 Operator' }]}
          />
        </div>
        {form.tenant_type === 'operator' && (
          <div className="space-y-1.5">
            <Label>Parent City</Label>
            <MobileSelect
              value={form.parent_city_tenant_id}
              onChange={v => set('parent_city_tenant_id', v)}
              placeholder="Select city…"
              options={cityTenants.map(c => ({ value: c.id, label: c.company_name }))}
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Contact Email *</Label>
          <Input type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Contact Phone</Label>
          <Input value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} placeholder="+256..." />
        </div>
        <div className="space-y-1.5">
          <Label>Primary District *</Label>
          <MobileSelect
            value={form.district}
            onChange={v => set('district', v)}
            placeholder="Select district"
            options={UGANDA_DISTRICTS.map(d => ({ value: d, label: d }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Registration No.</Label>
          <Input value={form.registration_number} onChange={e => set('registration_number', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Admin Email</Label>
          <Input type="email" value={form.admin_email} onChange={e => set('admin_email', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Subscription Plan</Label>
          <MobileSelect
            value={form.subscription_plan}
            onChange={v => set('subscription_plan', v)}
            options={[{ value: 'basic', label: 'Basic' }, { value: 'standard', label: 'Standard' }, { value: 'premium', label: 'Premium' }]}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <MobileSelect
            value={form.status}
            onChange={v => set('status', v)}
            options={[{ value: 'pending', label: 'Pending' }, { value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' }]}
          />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Address</Label>
          <Input value={form.address} onChange={e => set('address', e.target.value)} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Notes</Label>
          <Textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.company_name || !form.contact_email || !form.district}>
          {mutation.isPending ? 'Saving...' : tenant ? 'Save Changes' : 'Create Tenant'}
        </Button>
      </div>
    </div>
  );
}