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
import { Plus, Search, Edit, Trash2, ClipboardList } from 'lucide-react';

const statusColor = { pending: 'bg-yellow-100 text-yellow-800', assigned: 'bg-blue-100 text-blue-800', in_progress: 'bg-indigo-100 text-indigo-800', completed: 'bg-green-100 text-green-800', cancelled: 'bg-red-100 text-red-800' };
const empty = { tenant_id:'', customer_id:'', zone_id:'', request_type:'on_demand', status:'pending', scheduled_date:'', scheduled_time:'', waste_type:'general', estimated_weight_kg:'', address:'', notes:'' };

export default function PickupRequests() {
  const [requests, setRequests] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [zones, setZones] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [r, c, t, z] = await Promise.all([
      base44.entities.PickupRequest.list('-created_date'),
      base44.entities.Customer.list(),
      base44.entities.Tenant.list(),
      base44.entities.ServiceZone.list()
    ]);
    setRequests(r); setCustomers(c); setTenants(t); setZones(z);
  };
  useEffect(() => { load(); }, []);

  const filtered = requests.filter(r => {
    const cust = customers.find(c => c.id === r.customer_id);
    const matchSearch = cust?.full_name?.toLowerCase().includes(search.toLowerCase()) || r.address?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || r.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const custName = (id) => customers.find(c => c.id === id)?.full_name || '—';
  const zoneName = (id) => zones.find(z => z.id === id)?.zone_name || '—';
  const openEdit = (r) => { setForm({...r}); setEditing(r.id); setOpen(true); };
  const openNew = () => { setForm(empty); setEditing(null); setOpen(true); };

  const save = async () => {
    setLoading(true);
    if (editing) await base44.entities.PickupRequest.update(editing, form);
    else await base44.entities.PickupRequest.create(form);
    await load(); setOpen(false); setLoading(false);
  };

  const remove = async (id) => {
    if (!confirm('Delete this request?')) return;
    await base44.entities.PickupRequest.delete(id); await load();
  };

  const filteredCustomers = customers.filter(c => !form.tenant_id || c.tenant_id === form.tenant_id);
  const filteredZones = zones.filter(z => !form.tenant_id || z.tenant_id === form.tenant_id);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-jakarta">Pickup Requests</h1>
          <p className="text-sm text-muted-foreground">{requests.filter(r => r.status === 'pending').length} pending requests</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" />New Request</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search customer, address..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {['pending','assigned','in_progress','completed','cancelled'].map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace('_',' ')}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-xl overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Customer</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Waste</TableHead>
              <TableHead>Zone</TableHead>
              <TableHead>Scheduled</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(r => (
              <TableRow key={r.id} className="hover:bg-muted/30">
                <TableCell className="font-medium text-sm">{custName(r.customer_id)}</TableCell>
                <TableCell><Badge variant="outline" className="capitalize text-xs">{r.request_type?.replace('_',' ')}</Badge></TableCell>
                <TableCell className="text-sm capitalize">{r.waste_type}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{zoneName(r.zone_id)}</TableCell>
                <TableCell className="text-sm">{r.scheduled_date || '—'} {r.scheduled_time && <span className="text-muted-foreground">{r.scheduled_time}</span>}</TableCell>
                <TableCell><Badge className={statusColor[r.status] || 'bg-gray-100'}>{r.status?.replace('_',' ')}</Badge></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openEdit(r)}><Edit className="w-3 h-3" /></Button>
                    <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => remove(r.id)}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No requests found</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Request' : 'New Pickup Request'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div>
              <Label>Tenant</Label>
              <Select value={form.tenant_id} onValueChange={v => setForm({...form,tenant_id:v,customer_id:'',zone_id:''})}>
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
              <Label>Zone</Label>
              <Select value={form.zone_id} onValueChange={v => setForm({...form,zone_id:v})}>
                <SelectTrigger><SelectValue placeholder="Select zone" /></SelectTrigger>
                <SelectContent>{filteredZones.map(z => <SelectItem key={z.id} value={z.id}>{z.zone_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {[
              ['request_type','Request Type',['scheduled','on_demand','bulk']],
              ['status','Status',['pending','assigned','in_progress','completed','cancelled']],
              ['waste_type','Waste Type',['general','recyclable','organic','hazardous','bulky']],
            ].map(([k,l,opts]) => (
              <div key={k}>
                <Label>{l}</Label>
                <Select value={form[k]} onValueChange={v => setForm({...form,[k]:v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{opts.map(o => <SelectItem key={o} value={o} className="capitalize">{o.replace('_',' ')}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ))}
            <div>
              <Label>Scheduled Date</Label>
              <Input type="date" value={form.scheduled_date||''} onChange={e => setForm({...form,scheduled_date:e.target.value})} />
            </div>
            <div>
              <Label>Scheduled Time</Label>
              <Input type="time" value={form.scheduled_time||''} onChange={e => setForm({...form,scheduled_time:e.target.value})} />
            </div>
            <div>
              <Label>Est. Weight (kg)</Label>
              <Input type="number" value={form.estimated_weight_kg||''} onChange={e => setForm({...form,estimated_weight_kg:e.target.value})} />
            </div>
            <div className="col-span-2">
              <Label>Address</Label>
              <Input value={form.address||''} onChange={e => setForm({...form,address:e.target.value})} />
            </div>
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