import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { PackagePlus, Plus, Pencil, Power } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import MobileSelect from '@/components/ui/MobileSelect';
import { useToast } from '@/components/ui/use-toast';

const CATEGORIES = [
  { value: 'bulky_item', label: 'Bulky Item' },
  { value: 'extra_pickup', label: 'Extra Pickup' },
  { value: 'roll_off', label: 'Roll-off Dumpster' },
  { value: 'hazardous', label: 'Hazardous' },
  { value: 'yard_waste', label: 'Yard Waste' },
  { value: 'other', label: 'Other' },
];
const UNITS = [
  { value: 'flat', label: 'Flat fee' },
  { value: 'per_item', label: 'Per item' },
  { value: 'per_day', label: 'Per day' },
  { value: 'per_tonne', label: 'Per tonne' },
];
const WASTE_TYPES = ['general', 'recyclable', 'organic', 'hazardous', 'bulky'];

const emptyAddOn = { name: '', description: '', category: 'bulky_item', price_ugx: 0, pricing_unit: 'flat', waste_type: 'bulky', requires_photo: false, active: true, sort_order: 0 };

export default function ServiceCatalog() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyAddOn);

  const { data: addOns = [], isLoading } = useQuery({
    queryKey: ['service-add-ons'],
    queryFn: () => base44.entities.ServiceAddOn.list('sort_order', 200),
  });

  const save = useMutation({
    mutationFn: (payload) => {
      const data = {
        ...payload,
        tenant_id: user?.tenant_id || 'default',
        price_ugx: Number(payload.price_ugx) || 0,
        sort_order: Number(payload.sort_order) || 0,
      };
      return editing
        ? base44.entities.ServiceAddOn.update(editing.id, data)
        : base44.entities.ServiceAddOn.create(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-add-ons'] });
      setOpen(false); setEditing(null); setForm(emptyAddOn);
      toast({ title: editing ? 'Service updated' : 'Service added' });
    },
    onError: (e) => toast({ title: 'Save failed', description: e.message, variant: 'destructive' }),
  });

  const toggleActive = useMutation({
    mutationFn: (a) => base44.entities.ServiceAddOn.update(a.id, { active: !a.active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['service-add-ons'] }),
  });

  const openNew = () => { setEditing(null); setForm(emptyAddOn); setOpen(true); };
  const openEdit = (a) => { setEditing(a); setForm({ ...emptyAddOn, ...a }); setOpen(true); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-jakarta flex items-center gap-2">
            <PackagePlus className="w-6 h-6 text-primary" /> Service Catalog
          </h1>
          <p className="text-muted-foreground text-sm mt-1">On-demand add-ons customers can order with upfront pricing — bulky item, extra pickup, roll-off</p>
        </div>
        <Button size="sm" className="gap-2" onClick={openNew}><Plus className="w-4 h-4" /> Add Service</Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : addOns.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <PackagePlus className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No add-on services yet. Add one so customers can self-serve extra pickups.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {addOns.map(a => (
            <Card key={a.id} className={`border-border/60 ${!a.active ? 'opacity-60' : ''}`}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold font-jakarta">{a.name}</p>
                      <Badge variant="secondary" className="text-[10px] capitalize">{a.category?.replace(/_/g, ' ')}</Badge>
                      {!a.active && <Badge variant="outline" className="text-[10px]">inactive</Badge>}
                    </div>
                    {a.description && <p className="text-xs text-muted-foreground mt-1">{a.description}</p>}
                    <p className="text-sm font-medium text-primary mt-2">
                      {(a.price_ugx || 0).toLocaleString()} UGX
                      <span className="text-xs text-muted-foreground font-normal"> / {UNITS.find(u => u.value === a.pricing_unit)?.label.toLowerCase() || a.pricing_unit}</span>
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(a)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleActive.mutate(a)}><Power className={`w-3.5 h-3.5 ${a.active ? 'text-green-600' : 'text-muted-foreground'}`} /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-jakarta">{editing ? 'Edit Service' : 'Add Service'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Name *"><input className="w-full border border-input bg-background rounded-lg px-3 py-2 text-sm" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Bulky item collection" /></Field>
            <Field label="Description"><textarea rows={2} className="w-full border border-input bg-background rounded-lg px-3 py-2 text-sm resize-none" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category"><MobileSelect value={form.category} onChange={v => setForm(f => ({ ...f, category: v }))} options={CATEGORIES} /></Field>
              <Field label="Waste Type"><MobileSelect value={form.waste_type} onChange={v => setForm(f => ({ ...f, waste_type: v }))} options={WASTE_TYPES.map(x => ({ value: x, label: x }))} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Price (UGX)"><input type="number" className="w-full border border-input bg-background rounded-lg px-3 py-2 text-sm" value={form.price_ugx} onChange={e => setForm(f => ({ ...f, price_ugx: e.target.value }))} /></Field>
              <Field label="Pricing Unit"><MobileSelect value={form.pricing_unit} onChange={v => setForm(f => ({ ...f, pricing_unit: v }))} options={UNITS} /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.requires_photo} onChange={e => setForm(f => ({ ...f, requires_photo: e.target.checked }))} />
              Require a photo when ordering
            </label>
            <Button className="w-full" disabled={!form.name || save.isPending} onClick={() => save.mutate(form)}>
              {save.isPending ? 'Saving…' : editing ? 'Update Service' : 'Add Service'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}
