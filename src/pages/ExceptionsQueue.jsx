import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { AlertTriangle, RefreshCw, Calendar, MessageSquare, ChevronUp, CheckCircle, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';

const severityColor = { low: 'bg-gray-100 text-gray-600', medium: 'bg-yellow-100 text-yellow-700', high: 'bg-orange-100 text-orange-700', critical: 'bg-red-100 text-red-700' };
const actionIcon = { retry: RefreshCw, reschedule: Calendar, escalate: ChevronUp, notify_customer: MessageSquare, close: CheckCircle };
const typeLabel = {
  missed_pickup: 'Missed Pickup', access_denied: 'Access Denied', bin_not_out: 'Bin Not Out',
  driver_incident: 'Driver Incident', vehicle_breakdown: 'Vehicle Breakdown', overweight: 'Overweight',
  weather: 'Weather', customer_absent: 'Customer Absent', wrong_address: 'Wrong Address', other: 'Other',
};

const DEFAULT_ACTIONS = {
  missed_pickup: 'reschedule', access_denied: 'notify_customer', bin_not_out: 'notify_customer',
  driver_incident: 'escalate', vehicle_breakdown: 'escalate', overweight: 'retry',
  weather: 'reschedule', customer_absent: 'reschedule', wrong_address: 'notify_customer', other: 'escalate',
};

export default function ExceptionsQueue() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState('open');
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const { data: exceptions = [], isLoading } = useQuery({
    queryKey: ['exceptions', statusFilter],
    queryFn: () => statusFilter === 'all' ? base44.entities.ExceptionQueue.list('-created_date', 100) : base44.entities.ExceptionQueue.filter({ status: statusFilter }, '-created_date', 100),
  });
  const { data: jobs = [] } = useQuery({ queryKey: ['pickup-recent'], queryFn: () => base44.entities.PickupRequest.list('-scheduled_date', 50) });

  const jobMap = Object.fromEntries(jobs.map(j => [j.id, j]));

  const actionMutation = useMutation({
    mutationFn: async ({ exception, action, notes, retryDate }) => {
      const update = {
        next_action_taken: action,
        status: action === 'close' ? 'closed' : 'actioned',
        actioned_by: 'current_user',
        actioned_at: new Date().toISOString(),
        resolution_notes: notes,
      };
      if (action === 'reschedule' && retryDate) update.retry_scheduled_date = retryDate;
      if (action === 'notify_customer') update.customer_notified = true;
      return base44.entities.ExceptionQueue.update(exception.id, update);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['exceptions'] }); toast({ title: 'Action taken' }); setSelected(null); },
  });

  const stats = {
    open: exceptions.filter(e => e.status === 'open').length,
    critical: exceptions.filter(e => e.severity === 'critical').length,
    aiPredicted: exceptions.filter(e => e.ai_predicted).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-jakarta flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-orange-500" /> Exceptions Queue
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {stats.open} open · {stats.critical} critical · {stats.aiPredicted} AI-predicted
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="actioned">Actioned</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setAddOpen(true)} className="gap-2"><Plus className="w-4 h-4" /> Log Exception</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : exceptions.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CheckCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No exceptions in this queue</p>
        </div>
      ) : (
        <div className="space-y-2">
          {exceptions.map(ex => {
            const job = jobMap[ex.pickup_request_id];
            const DefaultIcon = actionIcon[ex.default_next_action] || AlertTriangle;
            return (
              <div key={ex.id} className="p-4 rounded-xl border border-border/60 bg-card hover:shadow-sm transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-4 h-4 text-orange-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{typeLabel[ex.exception_type] || ex.exception_type}</span>
                      {ex.ai_predicted && <Badge variant="outline" className="text-xs text-primary border-primary/30">AI Predicted</Badge>}
                      <Badge className={`text-xs ${severityColor[ex.severity]}`} variant="secondary">{ex.severity}</Badge>
                      <Badge variant="secondary" className={`text-xs ${ex.status === 'open' ? 'bg-red-50 text-red-700' : ex.status === 'actioned' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{ex.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{ex.description}</p>
                    {job && <p className="text-xs text-muted-foreground mt-0.5">Job: {job.address} · {job.scheduled_date}</p>}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <DefaultIcon className="w-3 h-3" /> Default: {ex.default_next_action?.replace('_',' ')}
                      </span>
                      {ex.retry_scheduled_date && <span className="text-xs text-muted-foreground">Retry: {ex.retry_scheduled_date}</span>}
                    </div>
                  </div>
                  {ex.status === 'open' && (
                    <Button size="sm" variant="outline" onClick={() => setSelected(ex)} className="shrink-0 text-xs">Take Action</Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Action Dialog */}
      {selected && <ActionDialog exception={selected} onClose={() => setSelected(null)} onAction={actionMutation.mutate} saving={actionMutation.isPending} />}

      {/* Add Exception Dialog */}
      {addOpen && <AddExceptionDialog jobs={jobs} onClose={() => setAddOpen(false)} onSaved={() => { qc.invalidateQueries({ queryKey: ['exceptions'] }); setAddOpen(false); }} />}
    </div>
  );
}

function ActionDialog({ exception, onClose, onAction, saving }) {
  const [action, setAction] = useState(exception.default_next_action || 'reschedule');
  const [notes, setNotes] = useState('');
  const [retryDate, setRetryDate] = useState('');

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="font-jakarta">Take Action — {typeLabel[exception.exception_type]}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{exception.description}</p>
          <div className="space-y-1.5">
            <Label>Action</Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="retry">Retry immediately</SelectItem>
                <SelectItem value="reschedule">Reschedule</SelectItem>
                <SelectItem value="escalate">Escalate to manager</SelectItem>
                <SelectItem value="notify_customer">Notify customer</SelectItem>
                <SelectItem value="close">Close (no action)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {action === 'reschedule' && (
            <div className="space-y-1.5">
              <Label>Retry Date</Label>
              <Input type="date" value={retryDate} onChange={e => setRetryDate(e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Resolution Notes</Label>
            <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Explain what action was taken..." />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={() => onAction({ exception, action, notes, retryDate })} disabled={saving} className="flex-1">
              {saving ? 'Saving...' : 'Confirm Action'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddExceptionDialog({ jobs, onClose, onSaved }) {
  const [form, setForm] = useState({ exception_type: 'other', severity: 'medium', description: '', pickup_request_id: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.ExceptionQueue.create({
      ...form,
      default_next_action: DEFAULT_ACTIONS[form.exception_type] || 'escalate',
      status: 'open',
    });
    onSaved();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="font-jakarta">Log Exception</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.exception_type} onValueChange={v => set('exception_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(typeLabel).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Severity</Label>
              <Select value={form.severity} onValueChange={v => set('severity', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['low','medium','high','critical'].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Linked Job</Label>
            <Select value={form.pickup_request_id} onValueChange={v => set('pickup_request_id', v)}>
              <SelectTrigger><SelectValue placeholder="Select job..." /></SelectTrigger>
              <SelectContent>{jobs.slice(0,30).map(j => <SelectItem key={j.id} value={j.id}>{j.address} · {j.scheduled_date}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Description *</Label>
            <Textarea rows={3} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe what happened..." />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.description} className="flex-1">{saving ? 'Saving...' : 'Log Exception'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}