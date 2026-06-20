import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Package, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const GRADE_COLORS = { A: 'bg-green-100 text-green-700', B: 'bg-blue-100 text-blue-700', C: 'bg-yellow-100 text-yellow-700' };
const STATUS_COLORS = { available: 'bg-green-100 text-green-700', reserved: 'bg-yellow-100 text-yellow-700', sold: 'bg-gray-100 text-gray-500' };

const MATERIALS = ['plastic', 'paper', 'glass', 'metal', 'organic', 'e_waste', 'textile', 'mixed'];

export default function ListingsBoard() {
  const [showForm, setShowForm] = useState(false);
  const [posting, setPosting] = useState(false);
  const [form, setForm] = useState({ material: '', grade: 'B', quantity_kg: '', available_from: '' });
  const qc = useQueryClient();
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ['material-listings'],
    queryFn: () => base44.entities.MaterialListing.list('-created_date', 100),
  });

  const handlePost = async (e) => {
    e.preventDefault();
    setPosting(true);
    try {
      const res = await base44.functions.invoke('postMaterialListing', {
        material: form.material,
        grade: form.grade,
        quantity_kg: Number(form.quantity_kg),
        available_from: form.available_from || new Date().toISOString(),
      });
      toast.success(`Listing posted. ${res.data?.buyers_notified || 0} buyers notified.`);
      setForm({ material: '', grade: 'B', quantity_kg: '', available_from: '' });
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ['material-listings'] });
    } catch (e) {
      toast.error(e.message || 'Failed to post listing');
    }
    setPosting(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{listings.length} listing(s)</p>
        <Button size="sm" onClick={() => setShowForm(v => !v)}>
          <Plus className="w-4 h-4 mr-1" /> Post Listing
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> New Material Listing (AI Price Estimate)</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handlePost} className="grid gap-3 sm:grid-cols-2">
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
                <Label>Grade</Label>
                <Select value={form.grade} onValueChange={v => set('grade', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">A — Premium</SelectItem>
                    <SelectItem value="B">B — Standard</SelectItem>
                    <SelectItem value="C">C — Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Quantity (kg) *</Label>
                <Input type="number" min="1" value={form.quantity_kg} onChange={e => set('quantity_kg', e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label>Available From</Label>
                <Input type="datetime-local" value={form.available_from} onChange={e => set('available_from', e.target.value)} />
              </div>
              <div className="sm:col-span-2 flex gap-2 justify-end">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" size="sm" disabled={posting || !form.material || !form.quantity_kg}>
                  {posting ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Posting + AI pricing…</> : 'Post Listing'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground text-sm">Loading…</div>
      ) : listings.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">No listings yet.</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {listings.map(l => (
            <Card key={l.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-primary shrink-0" />
                    <span className="font-semibold text-sm capitalize">{l.material}</span>
                  </div>
                  <div className="flex gap-1.5">
                    {l.grade && <Badge className={`text-xs ${GRADE_COLORS[l.grade]}`}>Grade {l.grade}</Badge>}
                    <Badge className={`text-xs ${STATUS_COLORS[l.status]}`}>{l.status}</Badge>
                  </div>
                </div>
                <p className="text-sm font-medium">{(l.quantity_kg || 0).toLocaleString()} kg</p>
                {l.ai_estimated_price_ugx && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-primary" />
                    Est. UGX {l.ai_estimated_price_ugx.toLocaleString()}/kg
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Available {l.available_from ? new Date(l.available_from).toLocaleDateString() : 'Now'}
                  {l.expires_at ? ` · Expires ${new Date(l.expires_at).toLocaleDateString()}` : ''}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}