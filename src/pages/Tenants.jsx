import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Building2, Edit, Trash2 } from 'lucide-react';

const statusColor = { active: 'bg-green-100 text-green-800', suspended: 'bg-red-100 text-red-800', pending: 'bg-yellow-100 text-yellow-800' };
const empty = { company_name: '', contact_email: '', contact_phone: '', district: '', address: '', status: 'pending', subscription_plan: 'basic', admin_email: '', registration_number: '' };

export default function Tenants() {
  const [tenants, setTenants] = useState([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const data = await base44.entities.Tenant.list('-created_date');
    setTenants(data);
  };
  useEffect(() => { load(); }, []);

  const filtered = tenants.filter(t =>
    t.company_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.district?.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => { setForm(empty); setEditing(null); setOpen(true); };
  const openEdit = (t) => { setForm({ ...t }); setEditing(t.id); setOpen(true); };

  const save = async () => {
    setLoading(true);
    if (editing) await base44.entities.Tenant.update(editing, form);
    else await base44.entities.Tenant.create(form);
    await load();
    setOpen(false);
    setLoading(false);
  };

  const remove = async (id) => {
    if (!confirm('Delete this tenant?')) return;
    await base44.entities.Tenant.delete(id);
    await load();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-jakarta">Tenants</h1>
          <p className="text-sm text-muted-foreground">Manage waste management companies on the platform</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" />Add Tenant</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search tenants..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(t => (
          <Card key={t.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{t.company_name}</CardTitle>
                    <p className="text-xs text-muted-foreground">{t.district}</p>
                  </div>
                </div>
                <Badge className={statusColor[t.status] || 'bg-gray-100'}>{t.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Plan</span><span className="font-medium text-foreground capitalize">{t.subscription_plan}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Email</span><span className="font-medium text-foreground truncate max-w-[160px]">{t.contact_email}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Phone</span><span className="font-medium text-foreground">{t.contact_phone || '—'}</span>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => openEdit(t)}><Edit className="w-3 h-3" />Edit</Button>
                <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => remove(t.id)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-3 text-center py-12 text-muted-foreground">No tenants found</div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Tenant' : 'Add New Tenant'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            {[['company_name','Company Name'],['contact_email','Contact Email'],['contact_phone','Phone'],['admin_email','Admin Email'],['district','District'],['address','Address'],['registration_number','Registration No.']].map(([k,l]) => (
              <div key={k} className={k === 'address' ? 'col-span-2' : ''}>
                <Label>{l}</Label>
                <Input value={form[k] || ''} onChange={e => setForm({...form,[k]:e.target.value})} />
              </div>
            ))}
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({...form,status:v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['pending','active','suspended'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Plan</Label>
              <Select value={form.subscription_plan} onValueChange={v => setForm({...form,subscription_plan:v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['basic','standard','premium'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
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