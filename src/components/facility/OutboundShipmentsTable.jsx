import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2, Truck } from 'lucide-react';
import { toast } from 'sonner';

const MATERIALS = ['plastic', 'paper', 'glass', 'metal', 'organic', 'e_waste', 'textile', 'mixed'];

export default function OutboundShipmentsTable({ facilityId }) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ material: '', quantity_kg: '', shipped_at: '', settlement_ugx: '', buyer_id: '' });
  const qc = useQueryClient();
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const { data: shipments = [], isLoading } = useQuery({
    queryKey: ['outbound-shipments', facilityId],
    queryFn: () => base44.entities.OutboundShipment.filter({ facility_id: facilityId }, '-shipped_at', 50),
    enabled: !!facilityId,
  });

  const { data: buyers = [] } = useQuery({
    queryKey: ['recycler-buyers'],
    queryFn: () => base44.entities.RecyclerBuyer.filter({ status: 'active' }),
  });

  const buyerMap = Object.fromEntries(buyers.map(b => [b.id, b.company_name]));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await base44.functions.invoke('recordOutboundShipment', {
        facility_id: facilityId,
        material: form.material,
        buyer_id: form.buyer_id || null,
        quantity_kg: parseFloat(form.quantity_kg),
        shipped_at: form.shipped_at || new Date().toISOString(),
        settlement_ugx: parseFloat(form.settlement_ugx) || null,
      });
      toast.success('Shipment recorded');
      setForm({ material: '', quantity_kg: '', shipped_at: '', settlement_ugx: '', buyer_id: '' });
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ['outbound-shipments', facilityId] });
      qc.invalidateQueries({ queryKey: ['facility-yield', facilityId] });
    } catch (e) {
      toast.error(e.message || 'Failed to record shipment');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{shipments.length} shipment(s)</p>
        <Button size="sm" onClick={() => setShowForm(v => !v)}>
          <Plus className="w-4 h-4 mr-1" /> Record Shipment
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2"><CardTitle className="text-sm">New Outbound Shipment</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Material *</Label>
                <Select value={form.material} onValueChange={v => set('material', v)}>
                  <SelectTrigger><SelectValue placeholder="Select material…" /></SelectTrigger>
                  <SelectContent>
                    {MATERIALS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Quantity (kg) *</Label>
                <Input type="number" step="0.01" min="0" value={form.quantity_kg} onChange={e => set('quantity_kg', e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label>Buyer</Label>
                <Select value={form.buyer_id} onValueChange={v => set('buyer_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Optional buyer…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>None</SelectItem>
                    {buyers.map(b => <SelectItem key={b.id} value={b.id}>{b.company_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Settlement (UGX)</Label>
                <Input type="number" min="0" value={form.settlement_ugx} onChange={e => set('settlement_ugx', e.target.value)} placeholder="Optional" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Shipped At</Label>
                <Input type="datetime-local" value={form.shipped_at} onChange={e => set('shipped_at', e.target.value)} />
              </div>
              <div className="sm:col-span-2 flex gap-2 justify-end">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" size="sm" disabled={saving || !form.material || !form.quantity_kg}>
                  {saving ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Saving…</> : 'Record'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Loading…</div>
      ) : shipments.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">No outbound shipments recorded yet.</div>
      ) : (
        <div className="space-y-1.5">
          {shipments.map(s => (
            <div key={s.id} className="flex items-center justify-between text-xs p-3 rounded-lg bg-muted/40 border border-border">
              <div className="flex items-center gap-3">
                <Truck className="w-3.5 h-3.5 text-muted-foreground" />
                <div>
                  <span className="font-medium capitalize">{s.material}</span>
                  <span className="text-muted-foreground"> · {(s.quantity_kg || 0).toLocaleString()} kg</span>
                  {s.buyer_id && <span className="text-muted-foreground"> · {buyerMap[s.buyer_id] || s.buyer_id}</span>}
                </div>
              </div>
              <div className="text-right">
                {s.settlement_ugx > 0 && <p className="font-medium">UGX {s.settlement_ugx.toLocaleString()}</p>}
                <p className="text-muted-foreground">{s.shipped_at ? new Date(s.shipped_at).toLocaleDateString() : 'N/A'}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}