import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Package, ArrowRight, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const MOVEMENT_TYPE_COLORS = {
  delivery: 'bg-green-100 text-green-800',
  swap: 'bg-blue-100 text-blue-800',
  recovery: 'bg-orange-100 text-orange-800',
  repair: 'bg-yellow-100 text-yellow-800',
  transfer: 'bg-purple-100 text-purple-800',
  write_off: 'bg-red-100 text-red-800',
};

const STATUS_COLORS = {
  planned: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

function MovementForm({ onClose }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    tenant_id: user?.tenant_id || '',
    movement_type: 'delivery',
    container_id: '',
    from_location_type: '',
    from_location_id: '',
    to_location_type: '',
    to_location_id: '',
    customer_id: '',
    condition: 'good',
    notes: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.container_id) { toast.error('Container ID is required'); return; }
    setLoading(true);
    const res = await base44.functions.invoke('recordAssetMovement', form);
    if (res.data?.success) {
      toast.success('Movement recorded successfully');
      onClose();
    } else {
      toast.error(res.data?.error || 'Failed to record movement');
    }
    setLoading(false);
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Movement Type</Label>
          <Select value={form.movement_type} onValueChange={v => set('movement_type', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {['delivery','swap','recovery','repair','transfer','write_off'].map(t => (
                <SelectItem key={t} value={t}>{t.replace('_',' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Condition</Label>
          <Select value={form.condition} onValueChange={v => set('condition', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="good">Good</SelectItem>
              <SelectItem value="damaged">Damaged</SelectItem>
              <SelectItem value="destroyed">Destroyed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Container ID <span className="text-destructive">*</span></Label>
        <Input value={form.container_id} onChange={e => set('container_id', e.target.value)} placeholder="Container ID" required />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>From Location Type</Label>
          <Select value={form.from_location_type} onValueChange={v => set('from_location_type', v)}>
            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="depot">Depot</SelectItem>
              <SelectItem value="service_point">Service Point</SelectItem>
              <SelectItem value="vehicle">Vehicle</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>From Location ID</Label>
          <Input value={form.from_location_id} onChange={e => set('from_location_id', e.target.value)} placeholder="ID" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>To Location Type</Label>
          <Select value={form.to_location_type} onValueChange={v => set('to_location_type', v)}>
            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="depot">Depot</SelectItem>
              <SelectItem value="service_point">Service Point</SelectItem>
              <SelectItem value="vehicle">Vehicle</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>To Location ID</Label>
          <Input value={form.to_location_id} onChange={e => set('to_location_id', e.target.value)} placeholder="ID" />
        </div>
      </div>

      <div>
        <Label>Customer ID (optional)</Label>
        <Input value={form.customer_id} onChange={e => set('customer_id', e.target.value)} placeholder="Customer ID" />
      </div>

      <div>
        <Label>Notes</Label>
        <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={loading}>{loading ? 'Recording...' : 'Record Movement'}</Button>
      </div>
    </form>
  );
}

export default function AssetMovements() {
  const { user } = useAuth();
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showForm, setShowForm] = useState(false);

  const { data: movements = [], isLoading, refetch } = useQuery({
    queryKey: ['asset-movements', filterType, filterStatus],
    queryFn: () => base44.entities.AssetMovement.list('-occurred_at', 200),
  });

  if (!['admin', 'super_admin'].includes(user?.role)) {
    return <div className="p-8 text-center text-muted-foreground">Access restricted to administrators.</div>;
  }

  const filtered = movements.filter(m => {
    if (filterType !== 'all' && m.movement_type !== filterType) return false;
    if (filterStatus !== 'all' && m.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-jakarta">Asset Movements</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track bin and container lifecycle movements</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Record Movement
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Movement Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {['delivery','swap','recovery','repair','transfer','write_off'].map(t => (
              <SelectItem key={t} value={t}>{t.replace('_',' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {['planned','in_progress','completed','cancelled'].map(s => (
              <SelectItem key={s} value={s}>{s.replace('_',' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} records</span>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">Loading movements...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No movements recorded yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Container</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Route</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Condition</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(m => (
                <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${MOVEMENT_TYPE_COLORS[m.movement_type] || ''}`}>
                      {m.movement_type?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{m.container_id?.slice(0, 12)}...</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="capitalize">{m.from_location_type || '—'}</span>
                      {(m.from_location_type || m.to_location_type) && <ArrowRight className="w-3 h-3" />}
                      <span className="capitalize">{m.to_location_type || '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="capitalize text-xs">{m.condition || '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[m.status] || ''}`}>
                      {m.status?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {m.occurred_at ? format(new Date(m.occurred_at), 'dd MMM yyyy HH:mm') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Record Movement Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Asset Movement</DialogTitle>
          </DialogHeader>
          <MovementForm onClose={() => { setShowForm(false); refetch(); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}