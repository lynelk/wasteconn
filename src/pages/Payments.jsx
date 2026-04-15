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
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Search, CreditCard, TrendingUp } from 'lucide-react';

const statusColor = { pending: 'bg-yellow-100 text-yellow-800', completed: 'bg-green-100 text-green-800', failed: 'bg-red-100 text-red-800', refunded: 'bg-purple-100 text-purple-800' };
const methodLabel = { mtn_momo: 'MTN MoMo', airtel_money: 'Airtel Money', cash: 'Cash', bank_transfer: 'Bank Transfer' };
const empty = { tenant_id:'', customer_id:'', amount_ugx:'', payment_method:'cash', status:'completed', transaction_ref:'', mobile_money_number:'', payment_date:'', period_from:'', period_to:'', notes:'' };

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [search, setSearch] = useState('');
  const [filterMethod, setFilterMethod] = useState('all');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [p, c, t] = await Promise.all([base44.entities.Payment.list('-created_date'), base44.entities.Customer.list(), base44.entities.Tenant.list()]);
    setPayments(p); setCustomers(c); setTenants(t);
  };
  useEffect(() => { load(); }, []);

  const filtered = payments.filter(p => {
    const cust = customers.find(c => c.id === p.customer_id);
    const matchSearch = cust?.full_name?.toLowerCase().includes(search.toLowerCase()) || p.transaction_ref?.toLowerCase().includes(search.toLowerCase());
    const matchMethod = filterMethod === 'all' || p.payment_method === filterMethod;
    return matchSearch && matchMethod;
  });

  const totalRevenue = payments.filter(p => p.status === 'completed').reduce((s, p) => s + (p.amount_ugx || 0), 0);
  const pendingRevenue = payments.filter(p => p.status === 'pending').reduce((s, p) => s + (p.amount_ugx || 0), 0);
  const custName = (id) => customers.find(c => c.id === id)?.full_name || '—';

  const openNew = () => { setForm(empty); setEditing(null); setOpen(true); };
  const openEdit = (p) => { setForm({...p}); setEditing(p.id); setOpen(true); };

  const save = async () => {
    setLoading(true);
    const payload = { ...form, amount_ugx: Number(form.amount_ugx) };
    if (editing) await base44.entities.Payment.update(editing, payload);
    else await base44.entities.Payment.create(payload);
    await load(); setOpen(false); setLoading(false);
  };

  const filteredCustomers = customers.filter(c => !form.tenant_id || c.tenant_id === form.tenant_id);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-jakarta">Payments</h1>
          <p className="text-sm text-muted-foreground">Track mobile money and cash payments</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" />Record Payment</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: `${(totalRevenue/1000).toFixed(0)}K UGX`, color: 'text-primary', bg: 'bg-secondary' },
          { label: 'Pending', value: `${(pendingRevenue/1000).toFixed(0)}K UGX`, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: 'MoMo Payments', value: payments.filter(p => ['mtn_momo','airtel_money'].includes(p.payment_method)).length, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Cash Payments', value: payments.filter(p => p.payment_method === 'cash').length, color: 'text-gray-600', bg: 'bg-gray-50' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-2xl font-bold font-jakarta">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search customer, ref..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterMethod} onValueChange={setFilterMethod}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All Methods" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Methods</SelectItem>
            {Object.entries(methodLabel).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-xl overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Customer</TableHead>
              <TableHead>Amount (UGX)</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Ref</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-16">Edit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(p => (
              <TableRow key={p.id} className="hover:bg-muted/30">
                <TableCell className="font-medium text-sm">{custName(p.customer_id)}</TableCell>
                <TableCell className="font-semibold text-sm">{(p.amount_ugx||0).toLocaleString()}</TableCell>
                <TableCell className="text-sm">{methodLabel[p.payment_method] || p.payment_method}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{p.payment_date || '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground font-mono">{p.transaction_ref || '—'}</TableCell>
                <TableCell><Badge className={statusColor[p.status] || 'bg-gray-100'}>{p.status}</Badge></TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openEdit(p)}><CreditCard className="w-3 h-3" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No payments found</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Payment' : 'Record Payment'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div>
              <Label>Tenant</Label>
              <Select value={form.tenant_id} onValueChange={v => setForm({...form,tenant_id:v,customer_id:''})}>
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
              <Label>Amount (UGX)</Label>
              <Input type="number" value={form.amount_ugx||''} onChange={e => setForm({...form,amount_ugx:e.target.value})} />
            </div>
            <div>
              <Label>Payment Date</Label>
              <Input type="date" value={form.payment_date||''} onChange={e => setForm({...form,payment_date:e.target.value})} />
            </div>
            {[
              ['payment_method','Method',['cash','mtn_momo','airtel_money','bank_transfer']],
              ['status','Status',['pending','completed','failed','refunded']],
            ].map(([k,l,opts]) => (
              <div key={k}>
                <Label>{l}</Label>
                <Select value={form[k]} onValueChange={v => setForm({...form,[k]:v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{opts.map(o => <SelectItem key={o} value={o}>{methodLabel[o] || o}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ))}
            {[['transaction_ref','Transaction Ref'],['mobile_money_number','MoMo Number'],['period_from','Period From'],['period_to','Period To']].map(([k,l]) => (
              <div key={k}>
                <Label>{l}</Label>
                <Input type={k.includes('period') ? 'date' : 'text'} value={form[k]||''} onChange={e => setForm({...form,[k]:e.target.value})} />
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