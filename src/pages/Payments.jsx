import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, CreditCard, Search, CheckCircle, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PaymentForm from '@/components/payments/PaymentForm';
import YoPaymentPanel from '@/components/payments/YoPaymentPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';

const statusColor = {
  pending: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  refunded: 'bg-gray-100 text-gray-600',
};
const methodIcons = { mtn_momo: '📱 MTN MoMo', airtel_money: '📱 Airtel', cash: '💵 Cash', bank_transfer: '🏦 Bank', yo_payments: '📲 Yo! Payments' };

export default function Payments() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [open, setOpen] = useState(false);

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['payments'],
    queryFn: () => base44.entities.Payment.list('-created_date'),
  });
  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: () => base44.entities.Customer.list() });

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

  const totalCompleted = payments.filter(p => p.status === 'completed').reduce((s, p) => s + (p.amount_ugx || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-jakarta">Payments</h1>
          <p className="text-muted-foreground text-sm mt-1">Total collected: <span className="font-semibold text-primary">{totalCompleted.toLocaleString()} UGX</span></p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Record Payment
        </Button>
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list"><CreditCard className="w-3.5 h-3.5 mr-1.5" />Payment Log</TabsTrigger>
          <TabsTrigger value="yo"><Smartphone className="w-3.5 h-3.5 mr-1.5" />Yo! Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="yo" className="mt-4">
          <YoPaymentPanel onPaymentCreated={() => qc.invalidateQueries({ queryKey: ['payments'] })} />
        </TabsContent>

        <TabsContent value="list" className="mt-4 space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by customer or ref..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
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
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-bold text-sm font-jakarta">{(p.amount_ugx||0).toLocaleString()} <span className="text-xs font-normal text-muted-foreground">UGX</span></span>
                  <Badge className={`text-xs ${statusColor[p.status]}`} variant="secondary">{p.status}</Badge>
                  {p.status === 'pending' && (
                    <Button size="sm" variant="outline" className="text-xs h-7 gap-1"
                      onClick={() => updateMutation.mutate({ id: p.id, data: { status: 'completed', payment_date: new Date().toISOString().split('T')[0] } })}>
                      <CheckCircle className="w-3 h-3" /> Confirm
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

        </TabsContent>
      </Tabs>

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