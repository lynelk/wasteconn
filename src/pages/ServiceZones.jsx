import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, MapPin, Edit, Trash2 } from 'lucide-react';

const days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const empty = { tenant_id: '', zone_name: '', district: '', sub_county: '', parish: '', zone_code: '', collection_days: [], collection_time: '', status: 'active', max_customers: 100 };

export default function ServiceZones() {
  const [zones, setZones] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [z, t] = await Promise.all([base44.entities.ServiceZone.list('-created_date'), base44.entities.Tenant.list()]);
    setZones(z); setTenants(t);
  };
  useEffect(() => { load(); }, []);

  const filtered = zones.filter(z =>
    z.zone_name?.toLowerCase().includes(search.toLowerCase()) ||
    z.district?.toLowerCase().includes(search.toLowerCase())
  );

  const tenantName = (id) => tenants.find(t => t.id === id)?.company_name || id;

  const openNew = () => { setForm(empty); setEditing(null); setOpen(true); };
  const openEdit = (z) => { setForm({ ...z }); setEditing(z.id); setOpen(true); };

  const toggleDay = (day) => {
    const days = form.collection_days || [];
    setForm({ ...form, collection_days: days.includes(day) ? days.filter(d => d !== day) : [...days, day] });
  };

  const save = async () => {
    setLoading(true);
    if (editing) await base44.entities.ServiceZone.update(editing, form);
    else await base44.entities.ServiceZone.create(form);
    await load(); setOpen(false); setLoading(false);
  };

  const remove = async (id) => {
    if (!confirm('Delete this zone?')) return;
    await base44.entities.ServiceZone.delete(id); await load();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-jakarta">Service Zones</h1>
          <p className="text-sm text-muted-foreground">Define collection zones per district and tenant</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" />Add Zone</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search zones..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(z => (
          <Card key={z.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{z.zone_name}</CardTitle>
                    <p className="text-xs text-muted-foreground">{z.zone_code} · {z.district}</p>
                  </div>
                </div>
                <Badge className={z.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}>{z.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Tenant</span><span className="font-medium text-foreground truncate max-w-[150px]">{tenantName(z.tenant_id)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Time</span><span className="font-medium text-foreground">{z.collection_time || '—'}</span>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Collection days</p>
                <div className="flex flex-wrap gap-1">
                  {(z.collection_days || []).map(d => (
                    <span key={d} className="text-[10px] bg-secondary text-secondary-foreground rounded px-1.5 py-0.5 capitalize">{d.slice(0,3)}</span>
                  ))}
                  {(!z.collection_days?.length) && <span className="text-xs text-muted-foreground">Not set</span>}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => openEdit(z)}><Edit className="w-3 h-3" />Edit</Button>
                <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => remove(z.id)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && <div className="col-span-3 text-center py-12 text-muted-foreground">No zones found</div>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Zone' : 'Add Service Zone'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div>
              <Label>Tenant</Label>
              <Select value={form.tenant_id} onValueChange={v => setForm({...form,tenant_id:v})}>
                <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
                <SelectContent>{tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.company_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {[['zone_name','Zone Name'],['zone_code','Zone Code'],['district','District'],['sub_county','Sub-County'],['parish','Parish'],['collection_time','Collection Time (e.g. 07:00-10:00)'],['max_customers','Max Customers']].map(([k,l]) => (
              <div key={k}>
                <Label>{l}</Label>
                <Input type={k === 'max_customers' ? 'number' : 'text'} value={form[k] || ''} onChange={e => setForm({...form,[k]:e.target.value})} />
              </div>
            ))}
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({...form,status:v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['active','inactive'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Collection Days</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {days.map(d => (
                  <button key={d} onClick={() => toggleDay(d)}
                    className={`text-xs px-3 py-1 rounded-full border capitalize transition-colors ${(form.collection_days||[]).includes(d) ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}>
                    {d.slice(0,3)}
                  </button>
                ))}
              </div>
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