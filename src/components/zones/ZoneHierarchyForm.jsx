import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const LEVELS = ['region', 'district', 'county', 'sub_county', 'town', 'village', 'custom'];
const EVIDENCE_TYPES = ['photo', 'gps', 'weight', 'signature'];

export default function ZoneHierarchyForm({ zone, parentPreset, allZones = [], tenants = [], onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: zone?.name || '',
    level: zone?.level || (parentPreset ? getNextLevel(parentPreset.level) : 'region'),
    parent_id: zone?.parent_id || parentPreset?.id || '',
    assigned_operator_id: zone?.assigned_operator_id || '',
    sla_hours: zone?.sla_hours || 24,
    required_evidence: zone?.required_evidence || [],
    collection_days: zone?.collection_days || [],
    population_estimate: zone?.population_estimate || '',
    area_sqkm: zone?.area_sqkm || '',
    status: zone?.status || 'active',
    custom_label: zone?.custom_label || '',
    ugx_zone_code: zone?.ugx_zone_code || '',
    notes: zone?.notes || '',
  });

  const mutation = useMutation({
    mutationFn: async (data) => {
      // Build path
      let path = data.name;
      if (data.parent_id) {
        const parent = allZones.find(z => z.id === data.parent_id);
        if (parent) path = `${parent.path || parent.name}/${data.name}`;
      }
      const payload = { ...data, path, sla_hours: Number(data.sla_hours), population_estimate: data.population_estimate ? Number(data.population_estimate) : undefined, area_sqkm: data.area_sqkm ? Number(data.area_sqkm) : undefined };
      return zone ? base44.entities.ZoneHierarchy.update(zone.id, payload) : base44.entities.ZoneHierarchy.create(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['zone-hierarchy'] }); onClose(); },
  });

  function getNextLevel(current) {
    const idx = LEVELS.indexOf(current);
    return LEVELS[Math.min(idx + 1, LEVELS.length - 1)];
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleEvidence = (e) => {
    const arr = form.required_evidence.includes(e) ? form.required_evidence.filter(x => x !== e) : [...form.required_evidence, e];
    set('required_evidence', arr);
  };

  const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
  const toggleDay = (d) => {
    const arr = form.collection_days.includes(d) ? form.collection_days.filter(x => x !== d) : [...form.collection_days, d];
    set('collection_days', arr);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Zone Name *</Label>
          <Input className="mt-1" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Kampala District" />
        </div>
        <div>
          <Label className="text-xs">Level *</Label>
          <Select value={form.level} onValueChange={v => set('level', v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LEVELS.map(l => <SelectItem key={l} value={l}>{l.replace('_', ' ')}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {form.level === 'custom' && (
        <div>
          <Label className="text-xs">Custom Level Label</Label>
          <Input className="mt-1" value={form.custom_label} onChange={e => set('custom_label', e.target.value)} placeholder="e.g. Parish" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Parent Zone</Label>
          <Select value={form.parent_id || 'none'} onValueChange={v => set('parent_id', v === 'none' ? '' : v)}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="None (root)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None (root level)</SelectItem>
              {allZones.filter(z => z.id !== zone?.id).map(z => (
                <SelectItem key={z.id} value={z.id}>{z.path || z.name} ({z.level})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Zone Code</Label>
          <Input className="mt-1" value={form.ugx_zone_code} onChange={e => set('ugx_zone_code', e.target.value)} placeholder="e.g. KLA-C-01" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Assigned Operator</Label>
          <Select value={form.assigned_operator_id || 'none'} onValueChange={v => set('assigned_operator_id', v === 'none' ? '' : v)}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Not assigned" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not assigned</SelectItem>
              {tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.company_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">SLA Hours</Label>
          <Input type="number" className="mt-1" value={form.sla_hours} onChange={e => set('sla_hours', e.target.value)} />
        </div>
      </div>

      <div>
        <Label className="text-xs mb-2 block">Required Evidence</Label>
        <div className="flex gap-2 flex-wrap">
          {EVIDENCE_TYPES.map(e => (
            <button key={e} onClick={() => toggleEvidence(e)} className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${form.required_evidence.includes(e) ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary'}`}>
              {e}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-xs mb-2 block">Collection Days</Label>
        <div className="flex gap-2 flex-wrap">
          {DAYS.map(d => (
            <button key={d} onClick={() => toggleDay(d)} className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${form.collection_days.includes(d) ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary'}`}>
              {d.slice(0,3)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Population Estimate</Label>
          <Input type="number" className="mt-1" value={form.population_estimate} onChange={e => set('population_estimate', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Area (sq km)</Label>
          <Input type="number" className="mt-1" value={form.area_sqkm} onChange={e => set('area_sqkm', e.target.value)} />
        </div>
      </div>

      <div>
        <Label className="text-xs">Status</Label>
        <Select value={form.status} onValueChange={v => set('status', v)}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="unserviced">Unserviced</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs">Notes</Label>
        <Textarea className="mt-1" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => mutation.mutate(form)} disabled={mutation.isPending || !form.name}>
          {mutation.isPending ? 'Saving...' : zone ? 'Update Zone' : 'Create Zone'}
        </Button>
      </div>
    </div>
  );
}