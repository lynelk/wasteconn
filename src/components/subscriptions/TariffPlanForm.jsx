import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Trash2 } from 'lucide-react';

export default function TariffPlanForm({ plan, tenantId, onClose, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    tenant_id: plan?.tenant_id || tenantId || '',
    plan_name: plan?.plan_name || '',
    description: plan?.description || '',
    customer_type: plan?.customer_type || 'all',
    frequency: plan?.frequency || 'weekly',
    price_ugx: plan?.price_ugx || '',
    setup_fee_ugx: plan?.setup_fee_ugx || 0,
    min_commitment_months: plan?.min_commitment_months || 1,
    billing_cycle: plan?.billing_cycle || 'monthly',
    billing_model: plan?.billing_model || 'flat_fee',
    overage_threshold_kg: plan?.overage_threshold_kg || '',
    overage_rate_ugx_per_kg: plan?.overage_rate_ugx_per_kg || '',
    invoice_due_days: plan?.invoice_due_days ?? 14,
    includes_recycling: plan?.includes_recycling || false,
    max_bins: plan?.max_bins || 1,
    terms_and_conditions_version: plan?.terms_and_conditions_version || '',
    tiered_pricing: plan?.tiered_pricing || [],
    status: plan?.status || 'active',
    sort_order: plan?.sort_order || 0,
  });

  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addTier = () => {
    setForm(f => ({
      ...f,
      tiered_pricing: [...f.tiered_pricing, { tier_name: '', min_bins: 1, max_bins: 5, price_ugx: 0 }],
    }));
  };

  const updateTier = (i, field, val) => {
    setForm(f => {
      const tiers = [...f.tiered_pricing];
      tiers[i] = { ...tiers[i], [field]: val };
      return { ...f, tiered_pricing: tiers };
    });
  };

  const removeTier = (i) => {
    setForm(f => ({ ...f, tiered_pricing: f.tiered_pricing.filter((_, idx) => idx !== i) }));
  };

  const handleSave = async () => {
    if (!form.plan_name || !form.price_ugx) {
      toast({ title: 'Plan name and price are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const data = { ...form, price_ugx: Number(form.price_ugx), max_bins: Number(form.max_bins) };
    if (form.billing_model === 'fixed_plus_overage_kg') {
      data.overage_threshold_kg = Number(form.overage_threshold_kg);
      data.overage_rate_ugx_per_kg = Number(form.overage_rate_ugx_per_kg);
    }
    if (plan?.id) {
      await base44.entities.ServicePlan.update(plan.id, data);
    } else {
      await base44.entities.ServicePlan.create(data);
    }
    setSaving(false);
    onSaved();
  };

  return (
    <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5 col-span-2">
          <Label>Plan Name *</Label>
          <Input value={form.plan_name} onChange={e => set('plan_name', e.target.value)} placeholder="e.g. Premium Commercial" />
        </div>
        <div className="space-y-1.5 col-span-2">
          <Label>Description</Label>
          <Textarea rows={2} value={form.description} onChange={e => set('description', e.target.value)} />
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
          <Label>Collection Frequency</Label>
          <Select value={form.frequency} onValueChange={v => set('frequency', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="twice_weekly">Twice Weekly</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="biweekly">Biweekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Pricing */}
      <div className="border border-border/60 rounded-xl p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">Tariff & Pricing</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Base Price (UGX) *</Label>
            <Input type="number" min={0} value={form.price_ugx} onChange={e => set('price_ugx', e.target.value)} placeholder="e.g. 50000" />
          </div>
          <div className="space-y-1.5">
            <Label>Setup Fee (UGX)</Label>
            <Input type="number" min={0} value={form.setup_fee_ugx} onChange={e => set('setup_fee_ugx', Number(e.target.value))} />
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
            <Label>Billing Model</Label>
            <Select value={form.billing_model} onValueChange={v => set('billing_model', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="flat_fee">Flat Fee</SelectItem>
                <SelectItem value="fixed_plus_overage_kg">Flat + Overage (kg)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.billing_model === 'fixed_plus_overage_kg' && (
            <>
              <div className="space-y-1.5">
                <Label>Included kg (threshold)</Label>
                <Input type="number" min={0} value={form.overage_threshold_kg} onChange={e => set('overage_threshold_kg', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Overage Rate (UGX/kg)</Label>
                <Input type="number" min={0} value={form.overage_rate_ugx_per_kg} onChange={e => set('overage_rate_ugx_per_kg', e.target.value)} />
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <Label>Invoice Due (days after month-end)</Label>
            <Input type="number" min={0} value={form.invoice_due_days} onChange={e => set('invoice_due_days', Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>Min Commitment (months)</Label>
            <Select value={String(form.min_commitment_months)} onValueChange={v => set('min_commitment_months', parseInt(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1,3,6,12,24,36].map(m => <SelectItem key={m} value={String(m)}>{m}mo</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Tiered Pricing */}
      <div className="border border-border/60 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Volume / Tiered Pricing <span className="text-xs font-normal text-muted-foreground">(optional)</span></p>
          <Button variant="outline" size="sm" onClick={addTier} className="text-xs gap-1 h-7">
            <Plus className="w-3 h-3" /> Add Tier
          </Button>
        </div>
        {form.tiered_pricing.length === 0 && (
          <p className="text-xs text-muted-foreground">No tiers defined — flat rate applies</p>
        )}
        {form.tiered_pricing.map((tier, i) => (
          <div key={i} className="grid grid-cols-5 gap-2 items-end">
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Tier Name</Label>
              <Input className="h-8 text-xs" value={tier.tier_name} onChange={e => updateTier(i, 'tier_name', e.target.value)} placeholder="e.g. Small" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Min Bins</Label>
              <Input className="h-8 text-xs" type="number" value={tier.min_bins} onChange={e => updateTier(i, 'min_bins', Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Max Bins</Label>
              <Input className="h-8 text-xs" type="number" value={tier.max_bins} onChange={e => updateTier(i, 'max_bins', Number(e.target.value))} />
            </div>
            <div className="flex gap-1 items-end">
              <div className="space-y-1 flex-1">
                <Label className="text-xs">Price (UGX)</Label>
                <Input className="h-8 text-xs" type="number" value={tier.price_ugx} onChange={e => updateTier(i, 'price_ugx', Number(e.target.value))} />
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeTier(i)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Limits & Features */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Max Bins</Label>
          <Input type="number" min={1} value={form.max_bins} onChange={e => set('max_bins', Number(e.target.value))} />
        </div>
        <div className="space-y-1.5">
          <Label>T&C Version</Label>
          <Input value={form.terms_and_conditions_version} onChange={e => set('terms_and_conditions_version', e.target.value)} placeholder="e.g. v2.1-2025" />
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={v => set('status', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 pt-6">
          <Switch id="recycling" checked={form.includes_recycling} onCheckedChange={v => set('includes_recycling', v)} />
          <Label htmlFor="recycling" className="text-sm">Includes Recycling</Label>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
        <Button onClick={handleSave} disabled={saving} className="flex-1">
          {saving ? 'Saving...' : plan ? 'Update Plan' : 'Create Plan'}
        </Button>
      </div>
    </div>
  );
}