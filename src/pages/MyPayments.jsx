import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CreditCard, FileText, Download, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useMyCustomer } from '@/hooks/useMyCustomer';
import CustomerInvoiceCard from '@/components/customer/CustomerInvoiceCard';
import CustomerStatementModal from '@/components/payments/CustomerStatementModal';

const paymentStatusColor = {
  pending: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  refunded: 'bg-gray-100 text-gray-600',
  expired: 'bg-gray-100 text-gray-500',
  under_review: 'bg-orange-100 text-orange-700',
};
const methodLabel = { mtn_momo: 'MTN MoMo', airtel_money: 'Airtel', cash: 'Cash', bank_transfer: 'Bank', yo_payments: 'Yo! Payments' };

export default function MyPayments() {
  const { data: customer, isLoading: loadingCustomer } = useMyCustomer();
  const [statementOpen, setStatementOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('payments');

  const { data: payments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ['my-payments', customer?.id],
    queryFn: () => base44.entities.Payment.filter({ customer_id: customer?.id }),
    enabled: !!customer?.id,
  });

  const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ['my-invoices', customer?.id],
    queryFn: () => base44.entities.Invoice.filter({ customer_id: customer?.id }),
    enabled: !!customer?.id,
  });

  const totalPaid = payments.filter(p => p.status === 'completed').reduce((s, p) => s + (p.amount_ugx || 0), 0);
  const dueInvoices = invoices.filter(i => i.status === 'issued' || i.status === 'overdue').length;

  if (!loadingCustomer && !customer) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <UserX className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p>No customer account is linked to your profile.</p>
      </div>
    );
  }

  const tabs = [
    { key: 'payments', label: 'Payments', icon: CreditCard },
    { key: 'invoices', label: 'Invoices', icon: FileText },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-jakarta">My Payments</h1>
          <p className="text-muted-foreground text-sm mt-1">{dueInvoices} due invoice(s)</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setStatementOpen(true)} disabled={!customer}>
          <Download className="w-4 h-4" /> Statement
        </Button>
      </div>

      <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
        <p className="text-xs text-muted-foreground">Total paid</p>
        <p className="text-2xl font-bold font-jakarta text-primary">{totalPaid.toLocaleString()} UGX</p>
      </div>

      <div className="flex bg-muted rounded-xl p-1 max-w-xs">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === tab.key ? 'bg-white shadow text-foreground' : 'text-muted-foreground'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'payments' && (
        <div className="space-y-3">
          {loadingPayments ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}</div>
          ) : payments.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No payments yet</p>
            </div>
          ) : (
            [...payments]
              .sort((a, b) => new Date(b.payment_date || b.created_date) - new Date(a.payment_date || a.created_date))
              .map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-card">
                  <div>
                    <p className="text-sm font-semibold">{(p.amount_ugx || 0).toLocaleString()} UGX</p>
                    <p className="text-xs text-muted-foreground">
                      {methodLabel[p.payment_method] || p.payment_method || '—'}
                      {p.payment_date ? ` · ${format(new Date(p.payment_date), 'MMM d, yyyy')}` : ''}
                    </p>
                    {p.transaction_ref && <p className="text-[10px] text-muted-foreground font-mono">Ref: {p.transaction_ref}</p>}
                  </div>
                  <Badge className={`text-xs ${paymentStatusColor[p.status] || 'bg-muted text-muted-foreground'}`} variant="secondary">
                    {p.status?.replace('_', ' ')}
                  </Badge>
                </div>
              ))
          )}
        </div>
      )}

      {activeTab === 'invoices' && (
        <div className="space-y-3">
          {loadingInvoices ? (
            <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}</div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No invoices yet</p>
            </div>
          ) : (
            invoices.map(invoice => (
              <CustomerInvoiceCard key={invoice.id} invoice={invoice} customer={customer} />
            ))
          )}
        </div>
      )}

      <CustomerStatementModal
        open={statementOpen}
        onClose={() => setStatementOpen(false)}
        customers={customer ? [customer] : []}
      />
    </div>
  );
}
