import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search } from 'lucide-react';

const statusColor = { active: 'bg-green-100 text-green-800', paused: 'bg-yellow-100 text-yellow-800', cancelled: 'bg-red-100 text-red-800', expired: 'bg-gray-100 text-gray-700' };
const methodLabel = { mtn_momo: 'MTN MoMo', airtel_money: 'Airtel Money', cash: 'Cash', bank_transfer: 'Bank' };
const empty = { tenant_id:'', customer_id:'', plan_id:'', zone_id:'', status:'active', start_date:'', end_date:'', next_billing_date:'', amount_ugx:'', payment_method:'cash', notes:'' };

export default function Subscriptions() {
  const [subs, setSubs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [plans, setPlans] = useState([]);
  const [zones, setZones] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [s, c, t, p, z] = await Promise.all([
      base44.entities.Subscription.list('-created_date'),
      base44.entities.Customer.list(),
      base44.entities.Tenant.list(),
      base44.entities.ServicePlan.list(),
      base44.entities.ServiceZone.list()
    ]);
    setSubs(s); setCustomers(c); setTenants(t); setPlans(p); setZones(z);
  };
  useEffect(() => { load(); }, []);

  const filtered = subs.filter(s => {
    const cust = customers.find(c => c.id === s.customer_id);
    const matchSearch = cust?.full_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || s.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const custName = (id) => customers.find(c => c.id === id)?.full_name || '—';
  const planName = (id) => plans.find(p => p.id === id)?.plan_name || '—';
  const zoneName = (id) => zones.find(z => z.id === id)?.zone_name || '—';
  const openEdit = (s) => { setForm({...s}); setEditing(s.id); setOpen(true); };
  const openNew = () => { setForm(empty); setEditing(null); setOpen(true); };

  const filteredCustomers = customers.filter(c => !form.tenant_id || c.tenant_id === form.tenant_id);
  const filteredPlans = plans.filter(p => !form.tenant_id || p.tenant_id === form.tenant_id);
  const filteredZones = zones.filter(z => !form.tenant_id || z.tenant_id === form.tenant_id);

  const save = async () => {
    setLoading(true);
    const payload = { ...form, amount_ugx: Number(form.amount_ugx) };
    if (editing) await base44.entities.Subscription.update(editing, payload);
    else await base44.entities.Subscription.create(payload);
    await load(); setOpen(false); setLoading(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-jakarta">Subscriptions</h1>
          <p className="text-sm text-muted-foreground">{subs.filter(s => s.status === 'active').length} active subscriptions</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" />Add Subscription</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search customer..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {['active','paused','cancelled','expired'].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-xl overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Customer</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Zone</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Next Billing</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-16">Edit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(s => (
              <TableRow key={s.id} className="hover:bg-muted/30">
                <TableCell className="font-medium text-sm">{custName(s.customer_id)}</TableCell>
                <TableCell className="text-sm">{planName(s.plan_id)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{zoneName(s.zone_id)}</TableCell>
                <TableCell className="text-sm font-semibold">{(s.amount_ugx||0).toLocaleString()} UGX</TableCell>
                <TableCell className="text-sm">{methodLabel[s.payment_method] || s.payment_method}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{s.next_billing_date || '—'}</TableCell>
                <TableCell><Badge className={statusColor[s.status] || 'bg-gray-100'}>{s.status}</Badge></TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openEdit(s)}><Plus className="w-3 h-3 rotate-45" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No subscriptions found</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Subscription' : 'Add Subscription'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div>
              <Label>Tenant</Label>
              <Select value={form.tenant_id} onValueChange={v => setForm({...form,tenant_id:v,customer_id:'',plan_id:'',zone_id:''})}>
                <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
                <SelectContent>{tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.company_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Customer</Label>
              <Select value={form.customer_id} onValueChange={v => setForm({...form,customer_id:v})}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>{filteredCustomers.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Service Plan</Label>
              <Select value={form.plan_id} onValueChange={v => setForm({...form,plan_id:v})}>
                <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
                <SelectContent>{filteredPlans.map(p => <SelectItem key={p.id} value={p.id}>{p.plan_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Zone</Label>
              <Select value={form.zone_id} onValueChange={v => setForm({...form,zone_id:v})}>
                <SelectTrigger><SelectValue placeholder="Select zone" /></SelectTrigger>
                <SelectContent>{filteredZones.map(z => <SelectItem key={z.id} value={z.id}>{z.zone_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount (UGX)</Label>
              <Input type="number" value={form.amount_ugx||''} onChange={e => setForm({...form,amount_ugx:e.target.value})} />
            </div>
            {[
              ['status','Status',['active','paused','cancelled','expired']],
              ['payment_method','Payment Method',['cash','mtn_momo','airtel_money','bank_transfer']],
            ].map(([k,l,opts]) => (
              <div key={k}>
                <Label>{l}</Label>
                <Select value={form[k]} onValueChange={v => setForm({...form,[k]:v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{opts.map(o => <SelectItem key={o} value={o}>{methodLabel[o] || o}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ))}
            {[['start_date','Start Date'],['end_date','End Date'],['next_billing_date','Next Billing']].map(([k,l]) => (
              <div key={k}>
                <Label>{l}</Label>
                <Input type="date" value={form[k]||''} onChange={e => setForm({...form,[k]:e.target.value})} />
              </div>
            ))}
            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea value={form.notes||''} onChange={e => setForm({...form,notes:e.target.value})} rows={2} />
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