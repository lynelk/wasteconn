import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, addMonths } from 'date-fns';
import {
  Plus, Search, Edit2, Trash2, RefreshCw, CheckCircle,
  CreditCard, Calendar, XCircle, Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

const statusColor = {
  active: 'bg-green-100 text-green-700',
  suspended: 'bg-orange-100 text-orange-700',
  cancelled: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
  expired: 'bg-gray-100 text-gray-500',
};

function SubscriptionForm({ subscription, customers, plans, onClose, onSaved }) {
  const [form, setForm] = useState(subscription || {
    customer_id: '',
    plan_id: '',
    status: 'active',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: '',
    billing_cycle: 'monthly',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (subscription?.id) {
      await base44.entities.Subscription.update(subscription.id, form);
    } else {
      // Auto-set end date 1 month from start
      const endDate = form.end_date || format(addMonths(new Date(form.start_date), 1), 'yyyy-MM-dd');
      await base44.entities.Subscription.create({ ...form, end_date: endDate });
    }
    onSaved();
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Customer</Label>
        <Select value={form.customer_id} onValueChange={v => set('customer_id', v)}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Select customer..." /></SelectTrigger>
          <SelectContent>
            {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name} — {c.customer_type}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Service Plan</Label>
        <Select value={form.plan_id} onValueChange={v => set('plan_id', v)}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Select plan..." /></SelectTrigger>
          <SelectContent>
            {plans.map(p => <SelectItem key={p.id} value={p.id}>{p.plan_name} — {(p.price_ugx||0).toLocaleString()} UGX/{p.billing_cycle}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Start Date</Label>
          <Input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label>End Date</Label>
          <Input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} className="mt-1" />
        </div>
      </div>
      <div>
        <Label>Status</Label>
        <Select value={form.status} onValueChange={v => set('status', v)}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
        <Button onClick={handleSave} disabled={!form.customer_id || !form.plan_id} className="flex-1">
          {subscription ? 'Update' : 'Create'} Subscription
        </Button>
      </div>
    </div>
  );
}

export default function Subscriptions() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data: subscriptions = [], isLoading } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => base44.entities.Subscription.list('-created_date', 200),
  });
  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: () => base44.entities.Customer.list() });
  const { data: plans = [] } = useQuery({ queryKey: ['plans'], queryFn: () => base44.entities.ServicePlan.filter({ status: 'active' }) });

  const customerMap = Object.fromEntries(customers.map(c => [c.id, c]));
  const planMap = Object.fromEntries(plans.map(p => [p.id, p]));

  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.Subscription.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscriptions'] }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Subscription.update(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscriptions'] });
      toast({ title: 'Status updated' });
    },
  });

  const filtered = subscriptions.filter(s => {
    const c = customerMap[s.customer_id];
    const matchSearch = !search ||
      c?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      planMap[s.plan_id]?.plan_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const active = subscriptions.filter(s => s.status === 'active').length;
  const monthly = subscriptions
    .filter(s => s.status === 'active')
    .reduce((sum, s) => sum + (planMap[s.plan_id]?.price_ugx || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-jakarta flex items-center gap-2">
            <CreditCard className="w-6 h-6" /> Subscriptions
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {active} active · <span className="text-primary font-semibold">{monthly.toLocaleString()} UGX/mo MRR</span>
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> New Subscription
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Active', value: subscriptions.filter(s=>s.status==='active').length, color: 'text-green-600' },
          { label: 'Pending', value: subscriptions.filter(s=>s.status==='pending').length, color: 'text-yellow-600' },
          { label: 'Suspended', value: subscriptions.filter(s=>s.status==='suspended').length, color: 'text-orange-600' },
          { label: 'Cancelled', value: subscriptions.filter(s=>s.status==='cancelled'||s.status==='expired').length, color: 'text-red-600' },
        ].map(s => (
          <Card key={s.label} className="border-border/60">
            <CardContent className="pt-4 pb-4">
              <div className={`text-2xl font-bold font-jakarta ${s.color}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by customer or plan..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-16 rounded-xl bg-muted animate-pulse"/>)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No subscriptions found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(sub => {
            const customer = customerMap[sub.customer_id];
            const plan = planMap[sub.plan_id];
            return (
              <div key={sub.id} className="flex items-center gap-4 p-4 rounded-xl border border-border/60 bg-card hover:shadow-sm transition-shadow">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary">{customer?.full_name?.[0]?.toUpperCase() || '?'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{customer?.full_name || 'Unknown Customer'}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                    <span className="font-medium text-primary">{plan?.plan_name || 'Unknown Plan'}</span>
                    <span>·</span>
                    <span>{(plan?.price_ugx || 0).toLocaleString()} UGX/{plan?.billing_cycle || 'mo'}</span>
                    {sub.start_date && <span>· From {sub.start_date}</span>}
                    {sub.end_date && <span>· To {sub.end_date}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className={`text-xs ${statusColor[sub.status] || ''}`} variant="secondary">{sub.status}</Badge>
                  {sub.status === 'active' && (
                    <button
                      onClick={() => updateStatusMutation.mutate({ id: sub.id, status: 'suspended' })}
                      className="text-muted-foreground hover:text-orange-500 p-1.5"
                      title="Suspend"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {(sub.status === 'suspended' || sub.status === 'pending') && (
                    <button
                      onClick={() => updateStatusMutation.mutate({ id: sub.id, status: 'active' })}
                      className="text-muted-foreground hover:text-green-500 p-1.5"
                      title="Activate"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={() => { setEditing(sub); setOpen(true); }} className="text-muted-foreground hover:text-foreground p-1.5">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteMutation.mutate(sub.id)} className="text-muted-foreground hover:text-destructive p-1.5">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={() => { setOpen(false); setEditing(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-jakarta">{editing ? 'Edit Subscription' : 'New Subscription'}</DialogTitle>
          </DialogHeader>
          <SubscriptionForm
            subscription={editing}
            customers={customers}
            plans={plans}
            onClose={() => { setOpen(false); setEditing(null); }}
            onSaved={() => { qc.invalidateQueries({ queryKey: ['subscriptions'] }); setOpen(false); setEditing(null); toast({ title: editing ? 'Subscription updated' : 'Subscription created' }); }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}