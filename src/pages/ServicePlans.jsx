import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, CheckCircle2 } from 'lucide-react';

const empty = { tenant_id: '', plan_name: '', description: '', customer_type: 'all', frequency: 'weekly', price_ugx: '', billing_cycle: 'monthly', includes_recycling: false, max_bins: 1, status: 'active', sort_order: 0 };

export default function ServicePlans() {
  const [plans, setPlans] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [filterTenant, setFilterTenant] = useState('all');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [p, t] = await Promise.all([base44.entities.ServicePlan.list('sort_order'), base44.entities.Tenant.list()]);
    setPlans(p); setTenants(t);
  };
  useEffect(() => { load(); }, []);

  const filtered = plans.filter(p => filterTenant === 'all' || p.tenant_id === filterTenant);
  const tenantName = (id) => tenants.find(t => t.id === id)?.company_name || '—';
  const openEdit = (p) => { setForm({...p}); setEditing(p.id); setOpen(true); };
  const openNew = () => { setForm(empty); setEditing(null); setOpen(true); };

  const save = async () => {
    setLoading(true);
    const payload = { ...form, price_ugx: Number(form.price_ugx), max_bins: Number(form.max_bins) };
    if (editing) await base44.entities.ServicePlan.update(editing, payload);
    else await base44.entities.ServicePlan.create(payload);
    await load(); setOpen(false); setLoading(false);
  };

  const remove = async (id) => {
    if (!confirm('Delete this plan?')) return;
    await base44.entities.ServicePlan.delete(id); await load();
  };

  const freqLabel = { daily: 'Daily', twice_weekly: '2x/week', weekly: 'Weekly', biweekly: 'Bi-weekly', monthly: 'Monthly' };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-jakarta">Service Plans</h1>
          <p className="text-sm text-muted-foreground">Define pricing tiers for each tenant</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" />Add Plan</Button>
      </div>

      <Select value={filterTenant} onValueChange={setFilterTenant}>
        <SelectTrigger className="w-52"><SelectValue placeholder="All Tenants" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Tenants</SelectItem>
          {tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.company_name}</SelectItem>)}
        </SelectContent>
      </Select>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(p => (
          <Card key={p.id} className={`hover:shadow-md transition-shadow ${p.status !== 'active' ? 'opacity-60' : ''}`}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle className="text-base">{p.plan_name}</CardTitle>
                <Badge className={p.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}>{p.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{tenantName(p.tenant_id)}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-2xl font-bold text-primary font-jakarta">
                {(p.price_ugx || 0).toLocaleString()} <span className="text-sm font-normal text-muted-foreground">UGX / {p.billing_cycle}</span>
              </div>
              {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Frequency</span><span>{freqLabel[p.frequency]}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Customer type</span><span className="capitalize">{p.customer_type}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Max bins</span><span>{p.max_bins}</span></div>
                {p.includes_recycling && (
                  <div className="flex items-center gap-1 text-primary text-xs mt-2"><CheckCircle2 className="w-3 h-3" /> Includes recycling</div>
                )}
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => openEdit(p)}><Edit className="w-3 h-3" />Edit</Button>
                <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => remove(p.id)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && <div className="col-span-3 text-center py-12 text-muted-foreground">No plans found</div>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Plan' : 'Add Service Plan'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div>
              <Label>Tenant</Label>
              <Select value={form.tenant_id} onValueChange={v => setForm({...form,tenant_id:v})}>
                <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
                <SelectContent>{tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.company_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Plan Name</Label>
              <Input value={form.plan_name||''} onChange={e => setForm({...form,plan_name:e.target.value})} />
            </div>
            <div className="col-span-2">
              <Label>Description</Label>
              <Textarea value={form.description||''} onChange={e => setForm({...form,description:e.target.value})} rows={2} />
            </div>
            <div>
              <Label>Price (UGX)</Label>
              <Input type="number" value={form.price_ugx||''} onChange={e => setForm({...form,price_ugx:e.target.value})} />
            </div>
            <div>
              <Label>Max Bins</Label>
              <Input type="number" value={form.max_bins||1} onChange={e => setForm({...form,max_bins:e.target.value})} />
            </div>
            {[
              ['customer_type','Customer Type',['all','residential','commercial','industrial']],
              ['frequency','Frequency',['daily','twice_weekly','weekly','biweekly','monthly']],
              ['billing_cycle','Billing Cycle',['monthly','quarterly','annually']],
              ['status','Status',['active','inactive']],
            ].map(([k,l,opts]) => (
              <div key={k}>
                <Label>{l}</Label>
                <Select value={form[k]} onValueChange={v => setForm({...form,[k]:v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{opts.map(o => <SelectItem key={o} value={o} className="capitalize">{o.replace('_',' ')}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ))}
            <div className="col-span-2 flex items-center gap-3">
              <Switch checked={form.includes_recycling} onCheckedChange={v => setForm({...form,includes_recycling:v})} />
              <Label>Includes recycling collection</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={loading}>{loading ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}