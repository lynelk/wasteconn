import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { differenceInDays, parseISO } from 'date-fns';
import {
  Plus, Search, Edit2, Trash2,
  CreditCard, Users, FileText, AlertTriangle,
  Sparkles, ChevronRight, Tag, LayoutGrid
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import ContractForm from '@/components/subscriptions/ContractForm';
import TariffPlanForm from '@/components/subscriptions/TariffPlanForm';
import ContractDetailPanel from '@/components/subscriptions/ContractDetailPanel';
import { useEntitiesByIds } from '@/hooks/useEntitiesByIds';

const statusColor = {
  active: 'bg-green-100 text-green-700',
  suspended: 'bg-orange-100 text-orange-700',
  cancelled: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
  expired: 'bg-gray-100 text-gray-500',
};

const planStatusColor = {
  active: 'bg-green-100 text-green-700',
  draft: 'bg-blue-100 text-blue-700',
  inactive: 'bg-gray-100 text-gray-500',
};

export default function Subscriptions() {
  const qc = useQueryClient();
  const { toast } = useToast();

  // Contracts state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [contractOpen, setContractOpen] = useState(false);
  const [editingContract, setEditingContract] = useState(null);
  const [detailSub, setDetailSub] = useState(null);

  // Tariff Plans state
  const [planSearch, setPlanSearch] = useState('');
  const [planOpen, setPlanOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);

  const { data: subscriptions = [], isLoading } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => base44.entities.Subscription.list('-created_date', 300),
  });
  const { data: plans = [] } = useQuery({ queryKey: ['plans'], queryFn: () => base44.entities.ServicePlan.list() });

  // Resolve only the customers referenced by the loaded subscriptions (not the whole table).
  const { map: customerMap } = useEntitiesByIds('Customer', subscriptions.map(s => s.customer_id));
  const planMap = Object.fromEntries(plans.map(p => [p.id, p]));

  const activePlans = plans.filter(p => p.status === 'active');

  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.Subscription.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['subscriptions'] }); toast({ title: 'Contract deleted' }); },
  });

  const deletePlanMutation = useMutation({
    mutationFn: id => base44.entities.ServicePlan.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['plans'] }); toast({ title: 'Plan deleted' }); },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Subscription.update(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscriptions'] });
      if (detailSub) setDetailSub(prev => ({ ...prev, status: 'active' }));
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

  const filteredPlans = plans.filter(p =>
    !planSearch || p.plan_name?.toLowerCase().includes(planSearch.toLowerCase()) || p.description?.toLowerCase().includes(planSearch.toLowerCase())
  );

  // Expiry alerts: active, non-auto-renew, ending within 30 days
  const expiryAlerts = subscriptions.filter(s => {
    if (s.status !== 'active' || !s.end_date) return false;
    const days = differenceInDays(parseISO(s.end_date), new Date());
    return days >= 0 && days <= 30;
  });

  const active = subscriptions.filter(s => s.status === 'active').length;
  const monthly = subscriptions
    .filter(s => s.status === 'active')
    .reduce((sum, s) => sum + (s.amount_ugx || planMap[s.plan_id]?.price_ugx || 0), 0);

  const openContractDetail = (sub) => setDetailSub(sub);
  const closeDetail = () => setDetailSub(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-jakarta flex items-center gap-2">
            <CreditCard className="w-6 h-6" /> Contracts & Tariff Plans
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {active} active contracts · <span className="text-primary font-semibold">{monthly.toLocaleString()} UGX/mo MRR</span>
            {' · '}{activePlans.length} tariff plans
          </p>
        </div>
      </div>

      {/* Expiry Alerts */}
      {expiryAlerts.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-orange-700 font-semibold text-sm">
            <AlertTriangle className="w-4 h-4" />
            {expiryAlerts.length} contract{expiryAlerts.length > 1 ? 's' : ''} expiring within 30 days
          </div>
          <div className="space-y-1">
            {expiryAlerts.map(s => {
              const c = customerMap[s.customer_id];
              const days = differenceInDays(parseISO(s.end_date), new Date());
              return (
                <div key={s.id} className="flex items-center justify-between text-sm text-orange-700">
                  <span>{c?.institution_name || c?.full_name} — {planMap[s.plan_id]?.plan_name}</span>
                  <span className="font-medium">{days}d remaining{s.auto_renew ? ' (auto-renew)' : ''}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Tabs defaultValue="contracts">
        <TabsList className="mb-2">
          <TabsTrigger value="contracts" className="gap-2">
            <FileText className="w-4 h-4" /> Contracts
          </TabsTrigger>
          <TabsTrigger value="tariff-plans" className="gap-2">
            <Tag className="w-4 h-4" /> Tariff Plans
          </TabsTrigger>
        </TabsList>

        {/* ─── CONTRACTS TAB ─── */}
        <TabsContent value="contracts" className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Active', value: subscriptions.filter(s=>s.status==='active').length, color: 'text-green-600' },
              { label: 'Pending', value: subscriptions.filter(s=>s.status==='pending').length, color: 'text-yellow-600' },
              { label: 'Suspended', value: subscriptions.filter(s=>s.status==='suspended').length, color: 'text-orange-600' },
              { label: 'Expired', value: subscriptions.filter(s=>s.status==='expired').length, color: 'text-gray-500' },
              { label: 'Signed', value: subscriptions.filter(s=>s.contract_signed).length, color: 'text-primary' },
            ].map(s => (
              <Card key={s.label} className="border-border/60">
                <CardContent className="pt-4 pb-4">
                  <div className={`text-2xl font-bold font-jakarta ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
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
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => { setEditingContract(null); setContractOpen(true); }} className="gap-2 ml-auto">
              <Plus className="w-4 h-4" /> New Contract
            </Button>
          </div>

          {/* Contract List */}
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
                const daysLeft = sub.end_date ? differenceInDays(parseISO(sub.end_date), new Date()) : null;
                const expiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;
                return (
                  <div
                    key={sub.id}
                    onClick={() => openContractDetail(sub)}
                    className="flex items-center gap-4 p-4 rounded-xl border border-border/60 bg-card hover:shadow-sm hover:border-primary/30 transition-all cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary">{customer?.full_name?.[0]?.toUpperCase() || '?'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{customer?.institution_name || customer?.full_name || 'Unknown'}</p>
                        {sub.ai_recommended_plan && <Badge variant="outline" className="text-xs text-primary border-primary/30"><Sparkles className="w-2.5 h-2.5 mr-1" />AI Pick</Badge>}
                        {sub.contract_signed && <Badge variant="outline" className="text-xs text-green-600 border-green-200">Signed</Badge>}
                        {sub.contract_document_url && <Badge variant="outline" className="text-xs text-blue-600 border-blue-200"><FileText className="w-2.5 h-2.5 mr-1" />Doc</Badge>}
                        {expiringSoon && <Badge className="text-xs bg-orange-100 text-orange-700" variant="secondary"><AlertTriangle className="w-2.5 h-2.5 mr-1" />{daysLeft}d</Badge>}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        <span className="font-medium text-primary">{plan?.plan_name || 'Unknown Plan'}</span>
                        <span>·</span>
                        <span>{(sub.amount_ugx || plan?.price_ugx || 0).toLocaleString()} UGX</span>
                        {sub.discount_pct > 0 && <span className="text-destructive">(-{sub.discount_pct}%)</span>}
                        <span>·</span>
                        <span className="capitalize">{sub.service_frequency || 'weekly'}</span>
                        {sub.end_date && <span>· ends {sub.end_date}</span>}
                        {sub.contract_version > 1 && <span>· v{sub.contract_version}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={`text-xs ${statusColor[sub.status] || ''}`} variant="secondary">{sub.status}</Badge>
                      <button onClick={e => { e.stopPropagation(); setEditingContract(sub); setContractOpen(true); }} className="text-muted-foreground hover:text-foreground p-1.5">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={e => { e.stopPropagation(); deleteMutation.mutate(sub.id); }} className="text-muted-foreground hover:text-destructive p-1.5">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ─── TARIFF PLANS TAB ─── */}
        <TabsContent value="tariff-plans" className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search plans..." className="pl-9" value={planSearch} onChange={e => setPlanSearch(e.target.value)} />
            </div>
            <Button onClick={() => { setEditingPlan(null); setPlanOpen(true); }} className="gap-2 ml-auto">
              <Plus className="w-4 h-4" /> New Tariff Plan
            </Button>
          </div>

          {filteredPlans.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <LayoutGrid className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No tariff plans found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPlans.map(plan => {
                const linked = subscriptions.filter(s => s.plan_id === plan.id && s.status === 'active').length;
                return (
                  <Card key={plan.id} className="border-border/60 hover:shadow-sm transition-shadow">
                    <CardContent className="pt-5 pb-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-sm">{plan.plan_name}</p>
                          <p className="text-xs text-muted-foreground capitalize mt-0.5">{plan.customer_type} · {plan.frequency?.replace(/_/g,' ')}</p>
                        </div>
                        <Badge className={`text-xs ${planStatusColor[plan.status] || ''}`} variant="secondary">{plan.status}</Badge>
                      </div>

                      <div className="bg-secondary/40 rounded-lg p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Base price</span>
                          <span className="font-bold text-primary">{(plan.price_ugx||0).toLocaleString()} UGX</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Billing</span>
                          <span className="text-xs capitalize">{plan.billing_cycle} · {plan.billing_model?.replace(/_/g,' ')}</span>
                        </div>
                        {plan.setup_fee_ugx > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Setup fee</span>
                            <span className="text-xs">{plan.setup_fee_ugx.toLocaleString()} UGX</span>
                          </div>
                        )}
                        {plan.min_commitment_months > 1 && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Min commitment</span>
                            <span className="text-xs">{plan.min_commitment_months} months</span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {plan.includes_recycling && <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">Recycling</Badge>}
                        {plan.tiered_pricing?.length > 0 && <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">{plan.tiered_pricing.length} Tiers</Badge>}
                        <Badge variant="secondary" className="text-xs">{plan.max_bins} bin{plan.max_bins > 1 ? 's' : ''} max</Badge>
                        <Badge variant="secondary" className="text-xs text-muted-foreground">{linked} active contracts</Badge>
                      </div>

                      {plan.description && <p className="text-xs text-muted-foreground">{plan.description}</p>}
                      {plan.terms_and_conditions_version && <p className="text-xs text-muted-foreground">T&C: {plan.terms_and_conditions_version}</p>}

                      <div className="flex gap-2 pt-1">
                        <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => { setEditingPlan(plan); setPlanOpen(true); }}>
                          <Edit2 className="w-3 h-3 mr-1" /> Edit
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 text-xs" onClick={() => deletePlanMutation.mutate(plan.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Contract Form Dialog */}
      <Dialog open={contractOpen} onOpenChange={() => { setContractOpen(false); setEditingContract(null); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-jakarta">{editingContract ? 'Edit Contract' : 'New Contract Setup'}</DialogTitle>
          </DialogHeader>
          <ContractForm
            subscription={editingContract}
            plans={activePlans}
            onClose={() => { setContractOpen(false); setEditingContract(null); }}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ['subscriptions'] });
              setContractOpen(false);
              setEditingContract(null);
              toast({ title: editingContract ? 'Contract updated' : 'Contract created' });
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Tariff Plan Form Dialog */}
      <Dialog open={planOpen} onOpenChange={() => { setPlanOpen(false); setEditingPlan(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-jakarta">{editingPlan ? 'Edit Tariff Plan' : 'New Tariff Plan'}</DialogTitle>
          </DialogHeader>
          <TariffPlanForm
            plan={editingPlan}
            onClose={() => { setPlanOpen(false); setEditingPlan(null); }}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ['plans'] });
              setPlanOpen(false);
              setEditingPlan(null);
              toast({ title: editingPlan ? 'Plan updated' : 'Plan created' });
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Contract Detail Side Panel */}
      <Dialog open={!!detailSub} onOpenChange={closeDetail}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-jakarta">Contract Details</DialogTitle>
          </DialogHeader>
          <ContractDetailPanel
            subscription={detailSub}
            customer={detailSub ? customerMap[detailSub.customer_id] : null}
            plan={detailSub ? planMap[detailSub.plan_id] : null}
            onEdit={() => { setEditingContract(detailSub); setDetailSub(null); setContractOpen(true); }}
            onStatusChange={(status) => updateStatusMutation.mutate({ id: detailSub.id, status })}
            onClose={closeDetail}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}