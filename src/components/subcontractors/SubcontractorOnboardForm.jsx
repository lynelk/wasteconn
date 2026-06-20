import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function SubcontractorOnboardForm({ initial, onSaved, onCancel }) {
  const [form, setForm] = useState({
    company_name: initial?.company_name || '',
    contact_name: initial?.contact_name || '',
    contact_phone: initial?.contact_phone || '',
    contact_email: initial?.contact_email || '',
    vehicle_count: initial?.vehicle_count || '',
    status: initial?.status || 'active',
    notes: initial?.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, vehicle_count: Number(form.vehicle_count) || 0, tenant_id: 'default' };
    if (initial?.id) {
      await base44.entities.Subcontractor.update(initial.id, payload);
    } else {
      await base44.entities.Subcontractor.create({ ...payload, onboarded_at: new Date().toISOString() });
    }
    setSaving(false);
    onSaved();
  };

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{initial ? 'Edit Subcontractor' : 'New Subcontractor'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1">
            <Label>Company Name *</Label>
            <Input value={form.company_name} onChange={e => set('company_name', e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label>Contact Name</Label>
            <Input value={form.contact_name} onChange={e => set('contact_name', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Contact Phone</Label>
            <Input value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Contact Email</Label>
            <Input type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Vehicle Count</Label>
            <Input type="number" min="0" value={form.vehicle_count} onChange={e => set('vehicle_count', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => set('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 space-y-1">
            <Label>Notes</Label>
            <Input value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
          <div className="sm:col-span-2 flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
            <Button type="submit" size="sm" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}