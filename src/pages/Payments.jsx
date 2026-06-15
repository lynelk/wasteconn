import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, CreditCard, Search, CheckCircle, Smartphone, FileText,
  BarChart2, AlertTriangle, RefreshCw, Landmark, Link, RotateCcw,
  ShieldAlert, CheckCircle2, XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import PaymentForm from '@/components/payments/PaymentForm';
import YoPaymentPanel from '@/components/payments/YoPaymentPanel';
import CollectionsDashboard from '@/components/payments/CollectionsDashboard';
import CustomerStatementModal from '@/components/payments/CustomerStatementModal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

const statusColor = {
  pending: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  refunded: 'bg-gray-100 text-gray-600',
  expired: 'bg-gray-100 text-gray-500',
  under_review: 'bg-orange-100 text-orange-700',
};
const methodIcons = {
  mtn_momo: '📱 MTN MoMo',
  airtel_money: '📱 Airtel',
  cash: '💵 Cash',
  bank_transfer: '🏦 Bank',
  yo_payments: '📲 Yo! Payments',
};

export default function Payments() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [open, setOpen] = useState(false);
  const [statementOpen, setStatementOpen] = useState(false);
  const [showCharts, setShowCharts] = useState(true);
  const [reconciling, setReconciling] = useState(false);
  const [fetchingSettlements, setFetchingSettlements] = useState(false);
  const [reconcileResult, setReconcileResult] = useState(null);
  const [settlements, setSettlements] = useState([]);
  const [refundingId, setRefundingId] = useState(null);
  const [linkGeneratingId, setLinkGeneratingId] = useState(null);

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['payments'],
    queryFn: () => base44.entities.Payment.list('-created_date'),
  });
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices-all'],
    queryFn: () => base44.entities.Invoice.list(),
  });

  const customerMap = Object.fromEntries(customers.map(c => [c.id, c]));

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Payment.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payments'] }),
  });

  const filtered = payments.filter(p => {
    const c = customerMap[p.customer_id];
    const matchSearch = c?.full_name?.toLowerCase().includes(search.toLowerCase()) || p.transaction_ref?.includes(search);
    const matchStatus = filterStatus === 'all' || p.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const flaggedPayments = payments.filter(p => p.status === 'under_review');

  const totalCompleted = payments.filter(p => p.status === 'completed').reduce((s, p) => s + (p.amount_ugx || 0), 0);

  const handleReconcile = async () => {
    setReconciling(true);
    try {
      const res = await base44.functions.invoke('reconcilePayments', {});
      setReconcileResult(res.data || res);
      toast({ title: 'Reconciliation complete', description: `${res.data?.summary?.discrepancy_count || 0} discrepancies found.` });
    } catch (e) {
      toast({ title: 'Reconciliation failed', description: e.message, variant: 'destructive' });
    } finally {
      setReconciling(false);
    }
  };

  const handleFetchSettlements = async () => {
    setFetchingSettlements(true);
    try {
      const res = await base44.functions.invoke('fetchSettlements', {});
      setSettlements(res.data?.settlements || []);
      toast({ title: 'Settlements fetched', description: `${res.data?.settlements_fetched || 0} records retrieved.` });
    } catch (e) {
      toast({ title: 'Failed to fetch settlements', description: e.message, variant: 'destructive' });
    } finally {
      setFetchingSettlements(false);
    }
  };

  const handleApproveReview = (payment) => {
    updateMutation.mutate({ id: payment.id, data: { status: 'completed', fraud_score: payment.fraud_score } });
    toast({ title: 'Payment approved', description: `${payment.transaction_ref || payment.id} approved and marked completed.` });
  };

  const handleRejectReview = async (payment) => {
    try {
      await base44.functions.invoke('initiateRefund', { payment_id: payment.id, reason: 'Rejected after fraud review' });
      qc.invalidateQueries({ queryKey: ['payments'] });
      toast({ title: 'Payment rejected & refunded', description: `Refund initiated for ${payment.transaction_ref || payment.id}.` });
    } catch (e) {
      toast({ title: 'Refund failed', description: e.message, variant: 'destructive' });
    }
  };

  const handleRefund = async (payment) => {
    setRefundingId(payment.id);
    try {
      await base44.functions.invoke('initiateRefund', { payment_id: payment.id });
      qc.invalidateQueries({ queryKey: ['payments'] });
      toast({ title: 'Refund initiated', description: `UGX ${(payment.amount_ugx || 0).toLocaleString()} will be returned to the customer.` });
    } catch (e) {
      toast({ title: 'Refund failed', description: e.message, variant: 'destructive' });
    } finally {
      setRefundingId(null);
    }
  };

  const handleGenerateLink = async (payment) => {
    setLinkGeneratingId(payment.id);
    try {
      const res = await base44.functions.invoke('generatePaymentLink', {
        customer_id: payment.customer_id,
        amount_ugx: payment.amount_ugx,
        description: `Payment for ${payment.transaction_ref || payment.id}`,
      });
      const url = res.data?.pay_url || res.pay_url;
      if (url) {
        navigator.clipboard?.writeText(url);
        toast({ title: 'Payment link copied!', description: url });
      }
    } catch (e) {
      toast({ title: 'Link generation failed', description: e.message, variant: 'destructive' });
    } finally {
      setLinkGeneratingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-jakarta">Payments</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Total collected: <span className="font-semibold text-primary">{totalCompleted.toLocaleString()} UGX</span>
            {flaggedPayments.length > 0 && (
              <span className="ml-2 text-orange-600 font-medium">· {flaggedPayments.length} flagged for review</span>
            )}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Button variant="outline" onClick={() => setStatementOpen(true)} className="gap-2">
            <FileText className="w-4 h-4" /> Statement
          </Button>
          <Button variant="outline" onClick={() => setShowCharts(v => !v)} className="gap-2">
            <BarChart2 className="w-4 h-4" /> {showCharts ? 'Hide' : 'Show'} Charts
          </Button>
          <Button onClick={() => setOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Record Payment
          </Button>
        </div>
      </div>

      {showCharts && <CollectionsDashboard payments={payments} invoices={invoices} />}

      <Tabs defaultValue="list">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="list"><CreditCard className="w-3.5 h-3.5 mr-1.5" />Payment Log</TabsTrigger>
          <TabsTrigger value="yo"><Smartphone className="w-3.5 h-3.5 mr-1.5" />Yo! Payments</TabsTrigger>
          {flaggedPayments.length > 0 && (
            <TabsTrigger value="flagged" className="text-orange-600">
              <ShieldAlert className="w-3.5 h-3.5 mr-1.5" />Flagged ({flaggedPayments.length})
            </TabsTrigger>
          )}
          <TabsTrigger value="reconciliation"><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Reconciliation</TabsTrigger>
          <TabsTrigger value="settlements"><Landmark className="w-3.5 h-3.5 mr-1.5" />Settlements</TabsTrigger>
        </TabsList>

        {/* Payment Log */}
        <TabsContent value="list" className="mt-4 space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search by customer or ref..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-16 rounded-xl bg-muted animate-pulse"/>)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No payments recorded</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(p => {
                const customer = customerMap[p.customer_id];
                return (
                  <div key={p.id} className="flex items-center gap-4 p-4 rounded-xl border border-border/60 bg-card">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-semibold text-sm">{customer?.full_name || '—'}</p>
                        <span className="text-xs text-muted-foreground">{methodIcons[p.payment_method]}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {p.payment_date ? format(new Date(p.payment_date), 'MMM d, yyyy') : '—'}
                        {p.transaction_ref && ` · Ref: ${p.transaction_ref}`}
                      </p>
                      {p.fraud_notes && (
                        <p className="text-xs text-orange-600 mt-0.5 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> {p.fraud_notes}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      <span className="font-bold text-sm font-jakarta">{(p.amount_ugx||0).toLocaleString()} <span className="text-xs font-normal text-muted-foreground">UGX</span></span>
                      <Badge className={`text-xs ${statusColor[p.status]}`} variant="secondary">{p.status?.replace('_', ' ')}</Badge>
                      {p.status === 'pending' && (
                        <Button size="sm" variant="outline" className="text-xs h-7 gap-1"
                          onClick={() => updateMutation.mutate({ id: p.id, data: { status: 'completed', payment_date: new Date().toISOString().split('T')[0] } })}>
                          <CheckCircle className="w-3 h-3" /> Confirm
                        </Button>
                      )}
                      {p.status === 'completed' && (
                        <>
                          <Button size="sm" variant="ghost" className="text-xs h-7 gap-1 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRefund(p)} disabled={refundingId === p.id}>
                            <RotateCcw className="w-3 h-3" /> Refund
                          </Button>
                          <Button size="sm" variant="ghost" className="text-xs h-7 gap-1 text-muted-foreground"
                            onClick={() => handleGenerateLink(p)} disabled={linkGeneratingId === p.id}>
                            <Link className="w-3 h-3" /> Link
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Yo! Payments */}
        <TabsContent value="yo" className="mt-4">
          <YoPaymentPanel onPaymentCreated={() => qc.invalidateQueries({ queryKey: ['payments'] })} />
        </TabsContent>

        {/* Flagged Payments */}
        <TabsContent value="flagged" className="mt-4 space-y-3">
          <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-xl">
            <ShieldAlert className="w-4 h-4 text-orange-600 shrink-0" />
            <p className="text-sm text-orange-800 dark:text-orange-200">These payments were flagged as high-risk by fraud detection and placed on hold. Review and approve or reject each one.</p>
          </div>
          {flaggedPayments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShieldAlert className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No payments currently under review</p>
            </div>
          ) : flaggedPayments.map(p => {
            const customer = customerMap[p.customer_id];
            return (
              <Card key={p.id} className="border-orange-200 dark:border-orange-800">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">{customer?.full_name || '—'}</span>
                        <Badge className="bg-orange-100 text-orange-700 text-xs">Score: {p.fraud_score}/100</Badge>
                        <Badge className={`text-xs ${statusColor[p.payment_method]}`} variant="secondary">{methodIcons[p.payment_method] || p.payment_method}</Badge>
                      </div>
                      <p className="text-sm font-bold font-jakarta">{(p.amount_ugx || 0).toLocaleString()} UGX</p>
                      {p.fraud_notes && (
                        <p className="text-xs text-orange-700 mt-1">{p.fraud_notes}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {p.payment_date ? format(new Date(p.payment_date), 'MMM d, yyyy') : '—'}
                        {p.transaction_ref && ` · Ref: ${p.transaction_ref}`}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" className="gap-1 bg-green-600 hover:bg-green-700 text-white h-8"
                        onClick={() => handleApproveReview(p)}>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                      </Button>
                      <Button size="sm" variant="destructive" className="gap-1 h-8"
                        onClick={() => handleRejectReview(p)}>
                        <XCircle className="w-3.5 h-3.5" /> Reject & Refund
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* Reconciliation */}
        <TabsContent value="reconciliation" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold font-jakarta text-sm">Gateway Reconciliation</h3>
              <p className="text-xs text-muted-foreground">Compare local payment records against CitoConnect gateway data.</p>
            </div>
            <Button onClick={handleReconcile} disabled={reconciling} className="gap-2">
              {reconciling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Run Reconciliation
            </Button>
          </div>

          {reconcileResult ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Local Payments', value: reconcileResult.summary?.local_payment_count, color: 'text-foreground' },
                  { label: 'Gateway Transactions', value: reconcileResult.summary?.gateway_transaction_count ?? '—', color: 'text-foreground' },
                  { label: 'Discrepancies', value: reconcileResult.summary?.discrepancy_count, color: reconcileResult.summary?.discrepancy_count > 0 ? 'text-red-600' : 'text-green-600' },
                  { label: 'High Severity', value: reconcileResult.summary?.high_severity, color: reconcileResult.summary?.high_severity > 0 ? 'text-red-600' : 'text-green-600' },
                ].map(s => (
                  <Card key={s.label} className="border-border/60">
                    <CardContent className="pt-4 pb-4">
                      <div className={`text-2xl font-bold font-jakarta ${s.color}`}>{s.value ?? '—'}</div>
                      <div className="text-xs text-muted-foreground">{s.label}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {!reconcileResult.summary?.gateway_available && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 rounded-xl text-sm text-yellow-800 dark:text-yellow-200">
                  CitoConnect credentials not configured — gateway comparison not available. Only local-only analysis shown.
                </div>
              )}

              {reconcileResult.discrepancies?.length > 0 ? (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Discrepancies</h4>
                  {reconcileResult.discrepancies.map((d, i) => (
                    <div key={i} className={`p-3 rounded-xl border text-sm ${d.severity === 'high' ? 'border-red-200 bg-red-50 dark:bg-red-950/20' : 'border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={`text-xs ${d.severity === 'high' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{d.type?.replace('_', ' ')}</Badge>
                        <Badge className="text-xs bg-gray-100 text-gray-600">{d.severity}</Badge>
                      </div>
                      <p className="text-sm">{d.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-500 opacity-60" />
                  <p className="text-sm font-medium text-green-600">No discrepancies found — records are clean</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <RefreshCw className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Run reconciliation to compare your records with the gateway</p>
            </div>
          )}
        </TabsContent>

        {/* Settlements */}
        <TabsContent value="settlements" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold font-jakarta text-sm">Settlement History</h3>
              <p className="text-xs text-muted-foreground">Track when CitoConnect transfers collected funds to your bank account.</p>
            </div>
            <Button onClick={handleFetchSettlements} disabled={fetchingSettlements} className="gap-2">
              {fetchingSettlements ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Landmark className="w-4 h-4" />}
              Fetch Settlements
            </Button>
          </div>

          {settlements.length > 0 ? (
            <div className="rounded-xl border border-border/60 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b border-border/60">
                    {['Date', 'Gateway Ref', 'Transactions', 'Amount (UGX)', 'Bank Ref', 'Status'].map(h => (
                      <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {settlements.map((s, i) => (
                    <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                      <td className="px-4 py-3 text-xs">{s.settlement_date || s.date || '—'}</td>
                      <td className="px-4 py-3 text-xs font-mono">{s.settlement_id || s.reference || '—'}</td>
                      <td className="px-4 py-3 text-sm">{s.transaction_count || s.count || '—'}</td>
                      <td className="px-4 py-3 text-sm font-semibold">{(s.amount || s.amount_ugx || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-xs font-mono">{s.bank_reference || s.bank_ref || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge className="text-xs bg-green-100 text-green-700">{s.status || 'settled'}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <Landmark className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Fetch settlements to see funds transferred to your bank account</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CustomerStatementModal open={statementOpen} onClose={() => setStatementOpen(false)} customers={customers} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-jakarta">Record Payment</DialogTitle>
          </DialogHeader>
          <PaymentForm onClose={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
