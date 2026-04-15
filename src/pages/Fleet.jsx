import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Truck, Edit, Trash2 } from 'lucide-react';

const statusColor = { available: 'bg-green-100 text-green-800', on_route: 'bg-blue-100 text-blue-800', maintenance: 'bg-yellow-100 text-yellow-800', retired: 'bg-gray-100 text-gray-700' };
const empty = { tenant_id:'', registration_number:'', vehicle_type:'truck', capacity_tonnes:'', status:'available', make_model:'', year:'', fuel_type:'diesel', last_service_date:'', next_service_date:'', notes:'' };

export default function Fleet() {
  const [vehicles, setVehicles] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [v, t] = await Promise.all([base44.entities.Vehicle.list('-created_date'), base44.entities.Tenant.list()]);
    setVehicles(v); setTenants(t);
  };
  useEffect(() => { load(); }, []);

  const filtered = vehicles.filter(v => {
    const matchSearch = v.registration_number?.toLowerCase().includes(search.toLowerCase()) || v.make_model?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || v.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const tenantName = (id) => tenants.find(t => t.id === id)?.company_name || '—';
  const openEdit = (v) => { setForm({...v}); setEditing(v.id); setOpen(true); };
  const openNew = () => { setForm(empty); setEditing(null); setOpen(true); };

  const save = async () => {
    setLoading(true);
    const payload = { ...form, capacity_tonnes: Number(form.capacity_tonnes), year: Number(form.year) };
    if (editing) await base44.entities.Vehicle.update(editing, payload);
    else await base44.entities.Vehicle.create(payload);
    await load(); setOpen(false); setLoading(false);
  };

  const remove = async (id) => {
    if (!confirm('Delete this vehicle?')) return;
    await base44.entities.Vehicle.delete(id); await load();
  };

  const vehicleIcon = { truck: '🚛', tipper: '🚚', compactor: '🗜️', pickup: '🛻', tricycle: '🛺' };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-jakarta">Fleet Management</h1>
          <p className="text-sm text-muted-foreground">{vehicles.filter(v => v.status === 'available').length} vehicles available</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" />Add Vehicle</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search reg, make/model..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {['available','on_route','maintenance','retired'].map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace('_',' ')}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(v => (
          <Card key={v.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-xl">
                    {vehicleIcon[v.vehicle_type] || '🚛'}
                  </div>
                  <div>
                    <CardTitle className="text-base">{v.registration_number}</CardTitle>
                    <p className="text-xs text-muted-foreground capitalize">{v.vehicle_type} · {v.make_model || 'Unknown model'}</p>
                  </div>
                </div>
                <Badge className={statusColor[v.status] || 'bg-gray-100'}>{v.status?.replace('_',' ')}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Tenant</span><span className="font-medium text-foreground truncate max-w-[160px]">{tenantName(v.tenant_id)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Capacity</span><span className="font-medium text-foreground">{v.capacity_tonnes ? `${v.capacity_tonnes}t` : '—'}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Next service</span><span className="font-medium text-foreground">{v.next_service_date || '—'}</span>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => openEdit(v)}><Edit className="w-3 h-3" />Edit</Button>
                <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => remove(v.id)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && <div className="col-span-3 text-center py-12 text-muted-foreground">No vehicles found</div>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Vehicle' : 'Add Vehicle'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div>
              <Label>Tenant</Label>
              <Select value={form.tenant_id} onValueChange={v => setForm({...form,tenant_id:v})}>
                <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
                <SelectContent>{tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.company_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {[['registration_number','Registration No.'],['make_model','Make & Model'],['year','Year'],['capacity_tonnes','Capacity (tonnes)']].map(([k,l]) => (
              <div key={k}>
                <Label>{l}</Label>
                <Input type={['year','capacity_tonnes'].includes(k) ? 'number' : 'text'} value={form[k]||''} onChange={e => setForm({...form,[k]:e.target.value})} />
              </div>
            ))}
            {[
              ['vehicle_type','Vehicle Type',['truck','tipper','compactor','pickup','tricycle']],
              ['status','Status',['available','on_route','maintenance','retired']],
              ['fuel_type','Fuel',['petrol','diesel','electric']],
            ].map(([k,l,opts]) => (
              <div key={k}>
                <Label>{l}</Label>
                <Select value={form[k]} onValueChange={v => setForm({...form,[k]:v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{opts.map(o => <SelectItem key={o} value={o} className="capitalize">{o}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ))}
            <div>
              <Label>Last Service Date</Label>
              <Input type="date" value={form.last_service_date||''} onChange={e => setForm({...form,last_service_date:e.target.value})} />
            </div>
            <div>
              <Label>Next Service Date</Label>
              <Input type="date" value={form.next_service_date||''} onChange={e => setForm({...form,next_service_date:e.target.value})} />
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