import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Calendar, Edit2, Search, Zap, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import PickupForm from '@/components/pickups/PickupForm';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

const statusColor = {
  pending: 'bg-yellow-100 text-yellow-800',
  assigned: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};
const typeColor = {
  scheduled: 'bg-blue-50 text-blue-600',
  on_demand: 'bg-orange-50 text-orange-600',
  bulk: 'bg-gray-100 text-gray-600',
};

export default function PickupRequests() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ customer_id: '', horizon_days: 30 });
  const [scheduling, setScheduling] = useState(false);

  const handleAISchedule = async () => {
    if (!scheduleForm.customer_id) return;
    setScheduling(true);
    try {
      const res = await base44.functions.invoke('aiScheduleGenerator', scheduleForm);
      toast({ title: 'Schedule Generated', description: `${res.data?.created_count || 0} pickups created. ${res.data?.summary || ''}` });
      qc.invalidateQueries({ queryKey: ['pickups'] });
      setScheduleOpen(false);
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setScheduling(false);
    }
  };

  const { data: pickups = [], isLoading } = useQuery({
    queryKey: ['pickups'],
    queryFn: () => base44.entities.PickupRequest.list('-created_date'),
  });
  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: () => base44.entities.Customer.list() });

  const customerMap = Object.fromEntries([
    ...customers.map(c => [c.id, c]),
    ...customers.filter(c => c.account_number).map(c => [c.account_number, c]),
  ]);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PickupRequest.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pickups'] }),
  });

  const filtered = pickups.filter(p => {
    const c = customerMap[p.customer_id];
    const matchSearch = c?.full_name?.toLowerCase().includes(search.toLowerCase()) || p.address?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || p.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-jakarta">Pickup Requests</h1>
          <p className="text-muted-foreground text-sm mt-1">{pickups.filter(p=>p.status==='pending').length} pending</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setScheduleOpen(true)} className="gap-2">
            <Zap className="w-4 h-4" /> AI Schedule
          </Button>
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> New Request
          </Button>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by customer or address..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="assigned">Assigned</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3,4].map(i=><div key={i} className="h-16 rounded-xl bg-muted animate-pulse"/>)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No pickup requests found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => {
            const customer = customerMap[p.customer_id];
            return (
              <div key={p.id} className="flex items-center gap-4 p-4 rounded-xl border border-border/60 bg-card hover:shadow-sm transition-shadow">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-sm">{customer?.full_name || 'Unknown Customer'}</p>
                    <Badge className={`text-xs ${typeColor[p.request_type]}`} variant="secondary">{p.request_type?.replace('_',' ')}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{p.address || 'No address'} · {p.waste_type} waste</p>
                  {p.scheduled_date && <p className="text-xs text-muted-foreground mt-0.5">📅 {format(new Date(p.scheduled_date), 'MMM d, yyyy')}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className={`text-xs ${statusColor[p.status]}`} variant="secondary">{p.status?.replace('_',' ')}</Badge>
                  {p.status === 'pending' && (
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => updateMutation.mutate({ id: p.id, data: { status: 'assigned' } })}>
                      Assign
                    </Button>
                  )}
                  {p.status === 'assigned' && (
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => updateMutation.mutate({ id: p.id, data: { status: 'completed' } })}>
                      Complete
                    </Button>
                  )}
                  <button onClick={() => { setEditing(p); setOpen(true); }} className="text-muted-foreground hover:text-foreground p-1.5">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* AI Schedule Generator Dialog */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-jakarta flex items-center gap-2"><Zap className="w-5 h-5 text-primary" /> AI Schedule Generator</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">Automatically generates recurring pickup schedules based on service plan, zone collection days, and demand history.</p>
            <div>
              <Label>Customer</Label>
              <Select value={scheduleForm.customer_id} onValueChange={v => setScheduleForm(f => ({ ...f, customer_id: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select customer..." /></SelectTrigger>
                <SelectContent>
                  {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Horizon (days)</Label>
              <Select value={String(scheduleForm.horizon_days)} onValueChange={v => setScheduleForm(f => ({ ...f, horizon_days: Number(v) }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="60">60 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setScheduleOpen(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleAISchedule} disabled={!scheduleForm.customer_id || scheduling} className="flex-1 gap-2">
                {scheduling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {scheduling ? 'Generating...' : 'Generate Schedule'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={() => { setOpen(false); setEditing(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-jakarta">{editing ? 'Edit Pickup Request' : 'New Pickup Request'}</DialogTitle>
          </DialogHeader>
          <PickupForm pickup={editing} onClose={() => { setOpen(false); setEditing(null); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}