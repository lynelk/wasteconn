import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import {
  Plus, Search, Edit2, Trash2, CheckCircle,
  CreditCard, XCircle, Users, FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import ContractForm from '@/components/subscriptions/ContractForm';

const statusColor = {
  active: 'bg-green-100 text-green-700',
  suspended: 'bg-orange-100 text-orange-700',
  cancelled: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
  expired: 'bg-gray-100 text-gray-500',
};
const billingColor = {
  prepaid: 'bg-blue-100 text-blue-700',
  postpaid: 'bg-purple-100 text-purple-700',
};

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
  const { data: servicePoints = [] } = useQuery({ queryKey: ['servicePoints'], queryFn: () => base44.entities.ServicePoint.list() });

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
      c?.institution_name?.toLowerCase().includes(search.toLowerCase()) ||
      planMap[s.plan_id]?.plan_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const active = subscriptions.filter(s => s.status === 'active').length;
  const monthly = subscriptions
    .filter(s => s.status === 'active')
    .reduce((sum, s) => sum + (s.amount_ugx || planMap[s.plan_id]?.price_ugx || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-jakarta flex items-center gap-2">
            <CreditCard className="w-6 h-6" /> Contracts & Subscriptions
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {active} active · <span className="text-primary font-semibold">{monthly.toLocaleString()} UGX/mo MRR</span>
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> New Contract
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Active', value: subscriptions.filter(s=>s.status==='active').length, color: 'text-green-600' },
          { label: 'Pending', value: subscriptions.filter(s=>s.status==='pending').length, color: 'text-yellow-600' },
          { label: 'Suspended', value: subscriptions.filter(s=>s.status==='suspended').length, color: 'text-orange-600' },
          { label: 'Prepaid', value: subscriptions.filter(s=>s.billing_model==='prepaid').length, color: 'text-blue-600' },
          { label: 'Postpaid', value: subscriptions.filter(s=>s.billing_model==='postpaid').length, color: 'text-purple-600' },
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
          <p>No contracts found</p>
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
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{customer?.institution_name || customer?.full_name || 'Unknown'}</p>
                    {sub.ai_recommended_plan && <Badge variant="outline" className="text-xs text-primary border-primary/30">AI Pick</Badge>}
                    {sub.contract_signed && <Badge variant="outline" className="text-xs text-green-600 border-green-200">Signed</Badge>}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                    <span className="font-medium text-primary">{plan?.plan_name || 'Unknown Plan'}</span>
                    <span>·</span>
                    <span>{(sub.amount_ugx || plan?.price_ugx || 0).toLocaleString()} UGX</span>
                    {sub.discount_pct > 0 && <span className="text-destructive">(-{sub.discount_pct}%)</span>}
                    <span>·</span>
                    <span className="capitalize">{sub.service_frequency || 'weekly'}</span>
                    {sub.start_date && <span>· {sub.start_date} → {sub.end_date || '∞'}</span>}
                    {sub.contract_duration_months && <span>· {sub.contract_duration_months}mo</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <Badge className={`text-xs ${billingColor[sub.billing_model] || ''}`} variant="secondary">{sub.billing_model || 'postpaid'}</Badge>
                  <Badge className={`text-xs ${statusColor[sub.status] || ''}`} variant="secondary">{sub.status}</Badge>
                  {sub.status === 'active' && (
                    <button onClick={() => updateStatusMutation.mutate({ id: sub.id, status: 'suspended' })} className="text-muted-foreground hover:text-orange-500 p-1.5" title="Suspend">
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {(sub.status === 'suspended' || sub.status === 'pending') && (
                    <button onClick={() => updateStatusMutation.mutate({ id: sub.id, status: 'active' })} className="text-muted-foreground hover:text-green-500 p-1.5" title="Activate">
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
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-jakarta">{editing ? 'Edit Contract' : 'New Contract Setup'}</DialogTitle>
          </DialogHeader>
          <ContractForm
            subscription={editing}
            customers={customers}
            plans={plans}
            servicePoints={servicePoints}
            onClose={() => { setOpen(false); setEditing(null); }}
            onSaved={() => { qc.invalidateQueries({ queryKey: ['subscriptions'] }); setOpen(false); setEditing(null); toast({ title: editing ? 'Contract updated' : 'Contract created' }); }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}