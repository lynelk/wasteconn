import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Users, Phone, Mail } from 'lucide-react';

const MATERIALS = ['plastic', 'paper', 'glass', 'metal', 'organic', 'e_waste', 'textile', 'mixed'];

function BuyerForm({ initial, onSaved, onCancel }) {
  const [form, setForm] = useState({
    company_name: initial?.company_name || '',
    contact_name: initial?.contact_name || '',
    contact_phone: initial?.contact_phone || '',
    contact_email: initial?.contact_email || '',
    materials_wanted: initial?.materials_wanted || [],
    min_grade: initial?.min_grade || 'B',
    price_per_kg_ugx: initial?.price_per_kg_ugx || '',
    pickup_radius_km: initial?.pickup_radius_km || '',
    status: initial?.status || 'active',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleMaterial = (m) => {
    setForm(f => ({
      ...f,
      materials_wanted: f.materials_wanted.includes(m)
        ? f.materials_wanted.filter(x => x !== m)
        : [...f.materials_wanted, m],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      price_per_kg_ugx: Number(form.price_per_kg_ugx) || 0,
      pickup_radius_km: Number(form.pickup_radius_km) || 0,
      tenant_id: 'default',
    };
    if (initial?.id) {
      await base44.entities.RecyclerBuyer.update(initial.id, payload);
    } else {
      await base44.entities.RecyclerBuyer.create(payload);
    }
    setSaving(false);
    onSaved();
  };

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-2"><CardTitle className="text-sm">{initial ? 'Edit Buyer' : 'Register Buyer'}</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1"><Label>Company Name *</Label><Input value={form.company_name} onChange={e => set('company_name', e.target.value)} required /></div>
          <div className="space-y-1"><Label>Contact Name</Label><Input value={form.contact_name} onChange={e => set('contact_name', e.target.value)} /></div>
          <div className="space-y-1"><Label>Phone</Label><Input value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} /></div>
          <div className="space-y-1"><Label>Email</Label><Input type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} /></div>
          <div className="space-y-1"><Label>Min Grade</Label>
            <Select value={form.min_grade} onValueChange={v => set('min_grade', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="A">A — Premium</SelectItem>
                <SelectItem value="B">B — Standard</SelectItem>
                <SelectItem value="C">C — Mixed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Price/kg (UGX)</Label><Input type="number" value={form.price_per_kg_ugx} onChange={e => set('price_per_kg_ugx', e.target.value)} /></div>
          <div className="space-y-1"><Label>Pickup Radius (km)</Label><Input type="number" value={form.pickup_radius_km} onChange={e => set('pickup_radius_km', e.target.value)} /></div>
          <div className="sm:col-span-2 space-y-1">
            <Label>Materials Wanted</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {MATERIALS.map(m => (
                <button type="button" key={m} onClick={() => toggleMaterial(m)}
                  className={`text-xs px-2 py-1 rounded-full border transition-colors ${form.materials_wanted.includes(m) ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                  {m}
                </button>
              ))}
            </div>
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

export default function BuyerManagementTab() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const qc = useQueryClient();

  const { data: buyers = [], isLoading } = useQuery({
    queryKey: ['recycler-buyers'],
    queryFn: () => base44.entities.RecyclerBuyer.list('-created_date', 100),
  });

  const handleSaved = () => { qc.invalidateQueries({ queryKey: ['recycler-buyers'] }); setShowForm(false); setEditing(null); };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{buyers.length} buyer(s)</p>
        <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Register Buyer
        </Button>
      </div>

      {showForm && <BuyerForm initial={editing} onSaved={handleSaved} onCancel={() => { setShowForm(false); setEditing(null); }} />}

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground text-sm">Loading…</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {buyers.map(b => (
            <Card key={b.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2"><Users className="w-4 h-4 text-primary shrink-0" /><p className="font-semibold text-sm">{b.company_name}</p></div>
                  <Badge className={b.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'} variant="outline">{b.status}</Badge>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(b.materials_wanted || []).map(m => <Badge key={m} variant="outline" className="text-xs">{m}</Badge>)}
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {b.contact_phone && <p className="flex items-center gap-1"><Phone className="w-3 h-3" />{b.contact_phone}</p>}
                  {b.contact_email && <p className="flex items-center gap-1"><Mail className="w-3 h-3" />{b.contact_email}</p>}
                  {b.price_per_kg_ugx > 0 && <p>UGX {b.price_per_kg_ugx.toLocaleString()}/kg · Min grade {b.min_grade}</p>}
                </div>
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { setEditing(b); setShowForm(true); }}>Edit</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}