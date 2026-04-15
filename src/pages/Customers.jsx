import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Edit, Trash2, User } from 'lucide-react';

const statusColor = { active: 'bg-green-100 text-green-800', inactive: 'bg-gray-100 text-gray-700', suspended: 'bg-red-100 text-red-800' };
const empty = { tenant_id: '', full_name: '', phone: '', email: '', customer_type: 'residential', address: '', district: '', zone_id: '', account_number: '', status: 'active', preferred_language: 'english', mobile_money_number: '', mobile_money_provider: 'none' };

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [zones, setZones] = useState([]);
  const [search, setSearch] = useState('');
  const [filterTenant, setFilterTenant] = useState('all');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [c, t, z] = await Promise.all([base44.entities.Customer.list('-created_date'), base44.entities.Tenant.list(), base44.entities.ServiceZone.list()]);
    setCustomers(c); setTenants(t); setZones(z);
  };
  useEffect(() => { load(); }, []);

  const filtered = customers.filter(c => {
    const matchSearch = c.full_name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search) || c.account_number?.includes(search);
    const matchTenant = filterTenant === 'all' || c.tenant_id === filterTenant;
    return matchSearch && matchTenant;
  });

  const tenantName = (id) => tenants.find(t => t.id === id)?.company_name || '—';
  const zoneName = (id) => zones.find(z => z.id === id)?.zone_name || '—';
  const openEdit = (c) => { setForm({ ...c }); setEditing(c.id); setOpen(true); };
  const openNew = () => { setForm(empty); setEditing(null); setOpen(true); };

  const save = async () => {
    setLoading(true);
    if (editing) await base44.entities.Customer.update(editing, form);
    else await base44.entities.Customer.create(form);
    await load(); setOpen(false); setLoading(false);
  };

  const remove = async (id) => {
    if (!confirm('Delete this customer?')) return;
    await base44.entities.Customer.delete(id); await load();
  };

  const filteredZones = zones.filter(z => !form.tenant_id || z.tenant_id === form.tenant_id);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-jakarta">Customers</h1>
          <p className="text-sm text-muted-foreground">{customers.length} registered customers</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" />Add Customer</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search name, phone, account..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterTenant} onValueChange={setFilterTenant}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All Tenants" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tenants</SelectItem>
            {tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.company_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-xl overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Customer</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead>Zone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(c => (
              <TableRow key={c.id} className="hover:bg-muted/30">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="w-3 h-3 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{c.full_name}</p>
                      <p className="text-xs text-muted-foreground">{c.account_number || c.email || '—'}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm">{c.phone}</TableCell>
                <TableCell><Badge variant="outline" className="capitalize text-xs">{c.customer_type}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">{tenantName(c.tenant_id)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{zoneName(c.zone_id)}</TableCell>
                <TableCell><Badge className={statusColor[c.status] || 'bg-gray-100 text-gray-700'}>{c.status}</Badge></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openEdit(c)}><Edit className="w-3 h-3" /></Button>
                    <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => remove(c.id)}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No customers found</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Customer' : 'Add Customer'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div>
              <Label>Tenant</Label>
              <Select value={form.tenant_id} onValueChange={v => setForm({...form,tenant_id:v,zone_id:''})}>
                <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
                <SelectContent>{tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.company_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {[['full_name','Full Name'],['phone','Phone'],['email','Email'],['address','Address'],['district','District'],['account_number','Account Number'],['mobile_money_number','Mobile Money No.']].map(([k,l]) => (
              <div key={k} className={k === 'address' ? 'col-span-2' : ''}>
                <Label>{l}</Label>
                <Input value={form[k]||''} onChange={e => setForm({...form,[k]:e.target.value})} />
              </div>
            ))}
            {[
              ['customer_type','Customer Type',['residential','commercial','industrial']],
              ['status','Status',['active','inactive','suspended']],
              ['preferred_language','Language',['english','luganda','swahili']],
              ['mobile_money_provider','MoMo Provider',['none','mtn','airtel']],
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
              <Label>Service Zone</Label>
              <Select value={form.zone_id} onValueChange={v => setForm({...form,zone_id:v})}>
                <SelectTrigger><SelectValue placeholder="Select zone" /></SelectTrigger>
                <SelectContent>{filteredZones.map(z => <SelectItem key={z.id} value={z.id}>{z.zone_name}</SelectItem>)}</SelectContent>
              </Select>
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