import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Gift, Plus, Pencil, Power } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import MobileSelect from '@/components/ui/MobileSelect';
import { useToast } from '@/components/ui/use-toast';

const REWARD_TYPES = [
  { value: 'wallet_credit', label: 'Wallet credit' },
  { value: 'perk', label: 'Perk' },
  { value: 'voucher', label: 'Voucher' },
  { value: 'discount', label: 'Discount' },
];

const emptyReward = { name: '', description: '', cost_points: 100, reward_type: 'wallet_credit', value_ugx: 0, image_url: '', stock: '', active: true, sort_order: 0 };

export default function LoyaltyRewards() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyReward);

  const { data: rewards = [], isLoading } = useQuery({
    queryKey: ['loyalty-rewards'],
    queryFn: () => base44.entities.LoyaltyReward.list('sort_order', 200),
  });

  const save = useMutation({
    mutationFn: (payload) => {
      const data = {
        ...payload,
        tenant_id: user?.tenant_id || 'default',
        cost_points: Number(payload.cost_points) || 0,
        value_ugx: Number(payload.value_ugx) || 0,
        sort_order: Number(payload.sort_order) || 0,
        stock: payload.stock === '' || payload.stock == null ? undefined : Number(payload.stock),
      };
      return editing
        ? base44.entities.LoyaltyReward.update(editing.id, data)
        : base44.entities.LoyaltyReward.create(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty-rewards'] });
      setOpen(false); setEditing(null); setForm(emptyReward);
      toast({ title: editing ? 'Reward updated' : 'Reward added' });
    },
    onError: (e) => toast({ title: 'Save failed', description: e.message, variant: 'destructive' }),
  });

  const toggleActive = useMutation({
    mutationFn: (r) => base44.entities.LoyaltyReward.update(r.id, { active: !r.active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loyalty-rewards'] }),
  });

  const openNew = () => { setEditing(null); setForm(emptyReward); setOpen(true); };
  const openEdit = (r) => { setEditing(r); setForm({ ...emptyReward, ...r, stock: r.stock == null ? '' : r.stock }); setOpen(true); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-jakarta flex items-center gap-2">
            <Gift className="w-6 h-6 text-primary" /> Loyalty Rewards
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Catalog customers redeem points against — wallet credit, perks & vouchers</p>
        </div>
        <Button size="sm" className="gap-2" onClick={openNew}><Plus className="w-4 h-4" /> Add Reward</Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : rewards.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Gift className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No rewards yet. Add one so customers can redeem their points.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rewards.map(r => (
            <Card key={r.id} className={`border-border/60 ${!r.active ? 'opacity-60' : ''}`}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold font-jakarta">{r.name}</p>
                      <Badge variant="secondary" className="text-[10px] capitalize">{r.reward_type?.replace('_', ' ')}</Badge>
                      {!r.active && <Badge variant="outline" className="text-[10px]">inactive</Badge>}
                    </div>
                    {r.description && <p className="text-xs text-muted-foreground mt-1">{r.description}</p>}
                    <p className="text-sm font-medium text-primary mt-2">
                      {(r.cost_points || 0).toLocaleString()} pts
                      {r.reward_type === 'wallet_credit' && <span className="text-xs text-muted-foreground font-normal"> → {(r.value_ugx || 0).toLocaleString()} UGX</span>}
                    </p>
                    {typeof r.stock === 'number' && <p className="text-[11px] text-muted-foreground mt-0.5">{r.stock} in stock</p>}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleActive.mutate(r)}><Power className={`w-3.5 h-3.5 ${r.active ? 'text-green-600' : 'text-muted-foreground'}`} /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-jakarta">{editing ? 'Edit Reward' : 'Add Reward'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Name *"><input className="w-full border border-input bg-background rounded-lg px-3 py-2 text-sm" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. 5,000 UGX wallet top-up" /></Field>
            <Field label="Description"><textarea rows={2} className="w-full border border-input bg-background rounded-lg px-3 py-2 text-sm resize-none" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cost (points)"><input type="number" className="w-full border border-input bg-background rounded-lg px-3 py-2 text-sm" value={form.cost_points} onChange={e => setForm(f => ({ ...f, cost_points: e.target.value }))} /></Field>
              <Field label="Reward Type"><MobileSelect value={form.reward_type} onChange={v => setForm(f => ({ ...f, reward_type: v }))} options={REWARD_TYPES} /></Field>
            </div>
            {form.reward_type === 'wallet_credit' && (
              <Field label="Wallet credit (UGX)"><input type="number" className="w-full border border-input bg-background rounded-lg px-3 py-2 text-sm" value={form.value_ugx} onChange={e => setForm(f => ({ ...f, value_ugx: e.target.value }))} /></Field>
            )}
            <Field label="Stock (blank = unlimited)"><input type="number" className="w-full border border-input bg-background rounded-lg px-3 py-2 text-sm" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} placeholder="Unlimited" /></Field>
            <Button className="w-full" disabled={!form.name || save.isPending} onClick={() => save.mutate(form)}>
              {save.isPending ? 'Saving…' : editing ? 'Update Reward' : 'Add Reward'}
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
