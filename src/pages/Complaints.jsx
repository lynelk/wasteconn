import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search, MessageSquare, AlertCircle } from 'lucide-react';

const statusColor = { open: 'bg-red-100 text-red-800', in_review: 'bg-yellow-100 text-yellow-800', resolved: 'bg-green-100 text-green-800', closed: 'bg-gray-100 text-gray-700' };
const priorityColor = { low: 'bg-gray-100 text-gray-600', medium: 'bg-yellow-100 text-yellow-700', high: 'bg-orange-100 text-orange-700', urgent: 'bg-red-100 text-red-700' };
const empty = { tenant_id:'', customer_id:'', category:'other', subject:'', description:'', status:'open', priority:'medium', assigned_to:'', resolution_notes:'', rating:'' };

export default function Complaints() {
  const [complaints, setComplaints] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [c, cu, t] = await Promise.all([base44.entities.Complaint.list('-created_date'), base44.entities.Customer.list(), base44.entities.Tenant.list()]);
    setComplaints(c); setCustomers(cu); setTenants(t);
  };
  useEffect(() => { load(); }, []);

  const filtered = complaints.filter(c => {
    const cust = customers.find(cu => cu.id === c.customer_id);
    const matchSearch = c.subject?.toLowerCase().includes(search.toLowerCase()) || cust?.full_name?.toLowerCase().includes(search.toLowerCase()) || c.category?.includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || c.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const custName = (id) => customers.find(c => c.id === id)?.full_name || '—';
  const openEdit = (c) => { setForm({...c}); setEditing(c.id); setOpen(true); };
  const openNew = () => { setForm(empty); setEditing(null); setOpen(true); };
  const filteredCustomers = customers.filter(c => !form.tenant_id || c.tenant_id === form.tenant_id);

  const save = async () => {
    setLoading(true);
    if (editing) await base44.entities.Complaint.update(editing, form);
    else await base44.entities.Complaint.create(form);
    await load(); setOpen(false); setLoading(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-jakarta">Complaints & Feedback</h1>
          <p className="text-sm text-muted-foreground">{complaints.filter(c => c.status === 'open').length} open complaints</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" />Log Complaint</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search subject, customer..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {['open','in_review','resolved','closed'].map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace('_',' ')}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(c => (
          <Card key={c.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => openEdit(c)}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="font-semibold text-sm leading-tight">{c.subject || c.category?.replace('_',' ')}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{custName(c.customer_id)}</p>
                </div>
                <div className="flex flex-col gap-1 items-end shrink-0">
                  <Badge className={statusColor[c.status] || 'bg-gray-100'}>{c.status?.replace('_',' ')}</Badge>
                  <Badge className={priorityColor[c.priority] || 'bg-gray-100'}>{c.priority}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground line-clamp-2">{c.description}</p>
              <div className="flex justify-between items-center mt-3">
                <Badge variant="outline" className="text-xs capitalize">{c.category?.replace('_',' ')}</Badge>
                {c.rating && <div className="text-xs text-muted-foreground">Rating: {c.rating}/5 ⭐</div>}
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && <div className="col-span-3 text-center py-12 text-muted-foreground">No complaints found</div>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Update Complaint' : 'Log Complaint'}</DialogTitle></DialogHeader>
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
            <div className="col-span-2">
              <Label>Subject</Label>
              <Input value={form.subject||''} onChange={e => setForm({...form,subject:e.target.value})} />
            </div>
            <div className="col-span-2">
              <Label>Description</Label>
              <Textarea value={form.description||''} onChange={e => setForm({...form,description:e.target.value})} rows={3} />
            </div>
            {[
              ['category','Category',['missed_collection','driver_behaviour','billing','service_quality','other']],
              ['status','Status',['open','in_review','resolved','closed']],
              ['priority','Priority',['low','medium','high','urgent']],
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
              <Label>Assigned To</Label>
              <Input value={form.assigned_to||''} onChange={e => setForm({...form,assigned_to:e.target.value})} />
            </div>
            <div>
              <Label>Customer Rating (1-5)</Label>
              <Input type="number" min="1" max="5" value={form.rating||''} onChange={e => setForm({...form,rating:e.target.value})} />
            </div>
            <div className="col-span-2">
              <Label>Resolution Notes</Label>
              <Textarea value={form.resolution_notes||''} onChange={e => setForm({...form,resolution_notes:e.target.value})} rows={2} />
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