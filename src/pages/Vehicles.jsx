import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Truck, Edit2, Trash2, Search } from 'lucide-react';
import ExportButton from '@/components/export/ExportButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import VehicleForm from '@/components/vehicles/VehicleForm';

const statusColor = {
  available: 'bg-green-100 text-green-700',
  on_route: 'bg-blue-100 text-blue-700',
  maintenance: 'bg-orange-100 text-orange-700',
  retired: 'bg-gray-100 text-gray-500',
};

export default function Vehicles() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => base44.entities.Tenant.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.Vehicle.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vehicles'] }),
  });

  const tenantName = (id) => tenants.find(t => t.id === id)?.company_name || null;

  const filtered = vehicles.filter(v => {
    const matchSearch =
      v.registration_number?.toLowerCase().includes(search.toLowerCase()) ||
      v.make_model?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || v.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-jakarta">Vehicles</h1>
          <p className="text-muted-foreground text-sm mt-1">{vehicles.filter(v=>v.status==='available').length} available</p>
        </div>
        <div className="flex gap-2">
          <ExportButton
            title="Vehicles"
            columns={[
              { label: 'Registration', key: 'registration_number' },
              { label: 'Type', key: 'vehicle_type' },
              { label: 'Make/Model', key: 'make_model' },
              { label: 'Status', key: 'status' },
              { label: 'Capacity (T)', key: 'capacity_tonnes' },
              { label: 'Fuel Type', key: 'fuel_type' },
              { label: 'Last Service', key: 'last_service_date' },
            ]}
            rows={vehicles}
          />
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Add Vehicle
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search vehicles..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="on_route">On route</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
            <SelectItem value="retired">Retired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{[1,2,3].map(i=><div key={i} className="h-32 rounded-xl bg-muted animate-pulse"/>)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Truck className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No vehicles yet</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(v => (
            <Card key={v.id} className="border-border/60 hover:shadow-md transition-shadow">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Truck className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-bold font-jakarta text-sm">{v.registration_number}</p>
                      <p className="text-xs text-muted-foreground capitalize">{v.vehicle_type} · {v.make_model || '—'}</p>
                    </div>
                  </div>
                  <Badge className={`text-xs ${statusColor[v.status]}`} variant="secondary">{v.status?.replace('_',' ')}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mb-3">
                  {v.capacity_tonnes && `${v.capacity_tonnes}T capacity`} {v.fuel_type && `· ${v.fuel_type}`}
                  {tenantName(v.tenant_id) && <span className="block mt-0.5">{tenantName(v.tenant_id)}</span>}
                </div>
                <div className="flex justify-end gap-1">
                  <button onClick={() => { setEditing(v); setOpen(true); }} className="text-muted-foreground hover:text-foreground p-1.5"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => deleteMutation.mutate(v.id)} className="text-muted-foreground hover:text-destructive p-1.5"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={() => { setOpen(false); setEditing(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-jakarta">{editing ? 'Edit Vehicle' : 'Add Vehicle'}</DialogTitle></DialogHeader>
          <VehicleForm vehicle={editing} onClose={() => { setOpen(false); setEditing(null); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}