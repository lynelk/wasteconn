import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Scale, AlertTriangle, CheckCircle2, Download, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import WasteBankTransactionForm from '@/components/wastebank/WasteBankTransactionForm';
import CustomerWalletView from '@/components/wastebank/CustomerWalletView';
import MobileSelect from '@/components/ui/MobileSelect';
import OfflineSyncBanner from '@/components/wastebank/OfflineSyncBanner';
import { useSyncManager } from '@/lib/useSyncManager';
import { format } from 'date-fns';

function exportCSV(rows, filename) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const csv = [keys.join(','), ...rows.map(r => keys.map(k => `"${r[k] ?? ''}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
}

const GRADE_COLORS = { A: 'bg-green-100 text-green-700', B: 'bg-yellow-100 text-yellow-700', C: 'bg-orange-100 text-orange-700', rejected: 'bg-red-100 text-red-700' };
const STATUS_COLORS = { pending: 'bg-yellow-100 text-yellow-700', processing: 'bg-blue-100 text-blue-700', completed: 'bg-green-100 text-green-700', failed: 'bg-red-100 text-red-700', reversed: 'bg-gray-100 text-gray-600' };

export default function WasteBank() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [txType, setTxType] = useState('payout');
  const [typeFilter, setTypeFilter] = useState('all');
  const [walletCustomer, setWalletCustomer] = useState(null);
  const { isOnline, pendingCount, syncing, lastSyncAt, syncNow } = useSyncManager();

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['waste-bank-transactions'],
    queryFn: () => base44.entities.WasteBankTransaction.list('-created_date', 200),
  });
  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: () => base44.entities.Customer.list() });
  const { data: wallets = [] } = useQuery({ queryKey: ['wallets'], queryFn: () => base44.entities.CustomerWallet.list() });

  const filtered = typeFilter === 'all' ? transactions : transactions.filter(t => t.transaction_type === typeFilter);
  const fraudFlags = transactions.filter(t => t.fraud_flag);
  const totalPayouts = transactions.filter(t => t.transaction_type === 'payout' && t.payment_status === 'completed').reduce((s, t) => s + (t.net_amount_ugx || 0), 0);
  const totalPayins = transactions.filter(t => t.transaction_type === 'payin' && t.payment_status === 'completed').reduce((s, t) => s + (t.net_amount_ugx || 0), 0);
  const totalWeightKg = transactions.filter(t => t.payment_status === 'completed').reduce((s, t) => s + (t.weight_kg || 0), 0);

  const getCustomer = id => customers.find(c => c.id === id);

  const openNew = (type) => { setTxType(type); setOpen(true); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-jakarta flex items-center gap-2">
            <Scale className="w-6 h-6 text-primary" /> CircularOS Waste Bank
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Agent weigh & grade workflow · Digital receipts · Mobile money payouts & payins</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => openNew('payout')}>
            <ArrowUpCircle className="w-4 h-4 text-green-600" /> Payout (Deposit Waste)
          </Button>
          <Button size="sm" className="gap-2" onClick={() => openNew('payin')}>
            <ArrowDownCircle className="w-4 h-4" /> Payin (Pay to Deposit)
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Payouts (UGX)', value: totalPayouts.toLocaleString(), color: 'text-green-600', icon: ArrowUpCircle },
          { label: 'Total Payins (UGX)', value: totalPayins.toLocaleString(), color: 'text-blue-600', icon: ArrowDownCircle },
          { label: 'Total Weight (kg)', value: totalWeightKg.toFixed(1), color: 'text-purple-600', icon: Scale },
          { label: 'Fraud Flags', value: fraudFlags.length, color: 'text-red-600', icon: AlertTriangle },
        ].map(s => (
          <Card key={s.label} className="border-border/60">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className={`text-xl font-bold font-jakarta ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
                <s.icon className={`w-5 h-5 ${s.color} opacity-50`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Offline sync banner */}
      <OfflineSyncBanner isOnline={isOnline} pendingCount={pendingCount} syncing={syncing} lastSyncAt={lastSyncAt} onSync={syncNow} />

      {/* Fraud Alert */}
      {fraudFlags.length > 0 && (
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">{fraudFlags.length} transaction(s) flagged for fraud review</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="transactions">
        <TabsList>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="wallets">Customer Wallets</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="mt-4 space-y-4">
          <div className="flex gap-3 flex-wrap items-center">
            <div className="w-36">
              <MobileSelect value={typeFilter} onChange={setTypeFilter} options={[{value:'all',label:'All Types'},{value:'payout',label:'Payout'},{value:'payin',label:'Payin'}]} />
            </div>
            <Button variant="outline" size="sm" className="gap-2 text-xs ml-auto" onClick={() => exportCSV(filtered.map(t => ({
              Number: t.transaction_number, Type: t.transaction_type, Customer: getCustomer(t.customer_id)?.full_name || '',
              Category: t.waste_category, Grade: t.grade, 'Weight kg': t.weight_kg, 'Net UGX': t.net_amount_ugx,
              Status: t.payment_status, Fraud: t.fraud_flag ? 'Yes' : 'No',
            })), 'waste_bank_transactions.csv')}>
              <Download className="w-3.5 h-3.5" /> Export CSV
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-2">{[1,2,3].map(i=><div key={i} className="h-16 rounded-lg bg-muted animate-pulse"/>)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Scale className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No transactions yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">Ref</th>
                    <th className="pb-2 font-medium">Type</th>
                    <th className="pb-2 font-medium">Customer</th>
                    <th className="pb-2 font-medium">Category</th>
                    <th className="pb-2 font-medium">Grade</th>
                    <th className="pb-2 font-medium">Weight</th>
                    <th className="pb-2 font-medium">Net (UGX)</th>
                    <th className="pb-2 font-medium">Payment</th>
                    <th className="pb-2 font-medium">Fraud</th>
                    <th className="pb-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(t => {
                    const cust = getCustomer(t.customer_id);
                    return (
                      <tr key={t.id} className={`border-b border-border/30 hover:bg-muted/30 ${t.fraud_flag ? 'bg-red-50/30' : ''}`}>
                        <td className="py-2 text-xs font-mono">{t.transaction_number || t.id.slice(0,8)}</td>
                        <td className="py-2">
                          <Badge className={`text-[10px] px-1.5 py-0 ${t.transaction_type === 'payout' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`} variant="secondary">
                            {t.transaction_type === 'payout' ? '↑ Payout' : '↓ Payin'}
                          </Badge>
                        </td>
                        <td className="py-2 text-xs">{cust?.full_name || '—'}</td>
                        <td className="py-2 text-xs capitalize">{t.waste_category}</td>
                        <td className="py-2"><Badge className={`text-[10px] px-1.5 py-0 ${GRADE_COLORS[t.grade]}`} variant="secondary">{t.grade}</Badge></td>
                        <td className="py-2 text-xs">{t.weight_kg} kg</td>
                        <td className="py-2 text-xs font-medium">{(t.net_amount_ugx || 0).toLocaleString()}</td>
                        <td className="py-2"><Badge className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[t.payment_status]}`} variant="secondary">{t.payment_status}</Badge></td>
                        <td className="py-2">{t.fraud_flag ? <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> : <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}</td>
                        <td className="py-2 text-xs text-muted-foreground">{t.created_date ? format(new Date(t.created_date), 'dd MMM') : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="wallets" className="mt-4">
          <CustomerWalletView wallets={wallets} customers={customers} transactions={transactions} />
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-jakarta">
              {txType === 'payout' ? '↑ Payout — Customer Deposits Waste' : '↓ Payin — Customer Pays to Deposit'}
            </DialogTitle>
          </DialogHeader>
          <WasteBankTransactionForm
            transactionType={txType}
            customers={customers}
            onClose={() => setOpen(false)}
            isOnline={isOnline}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}