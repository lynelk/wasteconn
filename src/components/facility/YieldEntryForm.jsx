import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Calculator } from 'lucide-react';
import { toast } from 'sonner';

export default function YieldEntryForm({ facilityId, facilityName }) {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    period: today,
    inbound_t: '',
    sorted_recyclable_t: '',
    sorted_organic_t: '',
    sorted_residue_t: '',
    recovered_energy_kwh: '',
    contamination_rate_pct: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const inbound = parseFloat(form.inbound_t) || 0;
  const residue = parseFloat(form.sorted_residue_t) || 0;
  const computedDiversion = inbound > 0 ? ((1 - residue / inbound) * 100).toFixed(1) : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!facilityId) return;
    setSaving(true);
    try {
      const res = await base44.functions.invoke('recordFacilityYield', {
        facility_id: facilityId,
        period: form.period,
        inbound_t: parseFloat(form.inbound_t),
        sorted_recyclable_t: parseFloat(form.sorted_recyclable_t) || 0,
        sorted_organic_t: parseFloat(form.sorted_organic_t) || 0,
        sorted_residue_t: parseFloat(form.sorted_residue_t) || 0,
        recovered_energy_kwh: parseFloat(form.recovered_energy_kwh) || null,
        contamination_rate_pct: parseFloat(form.contamination_rate_pct) || 0,
      });
      toast.success(`Yield recorded. Diversion rate: ${res.data?.diversion_rate_pct}%`);
      qc.invalidateQueries({ queryKey: ['facility-yield', facilityId] });
    } catch (e) {
      toast.error(e.message || 'Failed to record yield');
    }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Daily Yield Entry — {facilityName}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <Label>Date (Period) *</Label>
            <Input type="date" value={form.period} onChange={e => set('period', e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label>Inbound (tonnes) *</Label>
            <Input type="number" step="0.01" min="0" value={form.inbound_t} onChange={e => set('inbound_t', e.target.value)} required placeholder="e.g. 42.5" />
          </div>
          <div className="space-y-1">
            <Label>Sorted Recyclable (t)</Label>
            <Input type="number" step="0.01" min="0" value={form.sorted_recyclable_t} onChange={e => set('sorted_recyclable_t', e.target.value)} placeholder="e.g. 12.0" />
          </div>
          <div className="space-y-1">
            <Label>Sorted Organic (t)</Label>
            <Input type="number" step="0.01" min="0" value={form.sorted_organic_t} onChange={e => set('sorted_organic_t', e.target.value)} placeholder="e.g. 8.0" />
          </div>
          <div className="space-y-1">
            <Label>Sorted Residue (t)</Label>
            <Input type="number" step="0.01" min="0" value={form.sorted_residue_t} onChange={e => set('sorted_residue_t', e.target.value)} placeholder="e.g. 22.5" />
          </div>
          <div className="space-y-1">
            <Label>Contamination Rate (%)</Label>
            <Input type="number" step="0.1" min="0" max="100" value={form.contamination_rate_pct} onChange={e => set('contamination_rate_pct', e.target.value)} placeholder="e.g. 15" />
          </div>
          <div className="space-y-1">
            <Label>Recovered Energy (kWh) <span className="text-muted-foreground text-xs">W2E only</span></Label>
            <Input type="number" step="1" min="0" value={form.recovered_energy_kwh} onChange={e => set('recovered_energy_kwh', e.target.value)} placeholder="Optional" />
          </div>

          {computedDiversion !== null && (
            <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <Calculator className="w-4 h-4 text-primary" />
              <span className="text-sm">
                Computed diversion rate: <strong className="text-primary">{computedDiversion}%</strong>
                {parseFloat(computedDiversion) >= 70 ? ' ✓ Target met' : ' — below 70% target'}
              </span>
            </div>
          )}

          <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
            <Button type="submit" disabled={saving || !form.inbound_t}>
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</> : 'Record Yield'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}