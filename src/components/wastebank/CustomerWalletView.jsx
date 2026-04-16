import { useState } from 'react';
import { Wallet, ArrowUpCircle, ArrowDownCircle, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';

export default function CustomerWalletView({ wallets = [], customers = [], transactions = [] }) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const walletsWithCustomer = wallets.map(w => ({
    ...w,
    customer: customers.find(c => c.id === w.customer_id),
  })).filter(w => w.customer);

  const filtered = walletsWithCustomer.filter(w =>
    !search || w.customer?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    w.customer?.phone?.includes(search)
  );

  const selected = filtered.find(w => w.id === selectedId);
  const selectedTxs = selected ? transactions.filter(t => t.customer_id === selected.customer_id).sort((a,b) => new Date(b.created_date) - new Date(a.created_date)) : [];

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* List */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search customers..." className="pl-9 h-8 text-xs" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Wallet className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No wallets found</p>
          </div>
        ) : (
          filtered.map(w => (
            <Card key={w.id} className={`border-border/60 cursor-pointer hover:shadow-md transition-shadow ${selectedId === w.id ? 'ring-2 ring-primary' : ''}`} onClick={() => setSelectedId(w.id === selectedId ? null : w.id)}>
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{w.customer?.full_name}</p>
                    <p className="text-xs text-muted-foreground">{w.customer?.phone}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-sm font-jakarta ${(w.balance_ugx || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {(w.balance_ugx || 0).toLocaleString()} UGX
                    </p>
                    <Badge variant="secondary" className={`text-[10px] ${w.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {w.status}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><ArrowUpCircle className="w-3 h-3 text-green-500" /> Earned: {(w.total_earned_ugx||0).toLocaleString()}</span>
                  <span className="flex items-center gap-1"><ArrowDownCircle className="w-3 h-3 text-blue-500" /> Paid: {(w.total_paid_ugx||0).toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* History */}
      <div>
        {selected ? (
          <div className="space-y-3">
            <p className="font-semibold text-sm">{selected.customer?.full_name} — Transaction History</p>
            {selectedTxs.length === 0 ? (
              <p className="text-xs text-muted-foreground">No transactions</p>
            ) : (
              selectedTxs.map(t => (
                <div key={t.id} className="flex items-center justify-between border border-border/50 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    {t.transaction_type === 'payout' ? <ArrowUpCircle className="w-4 h-4 text-green-500" /> : <ArrowDownCircle className="w-4 h-4 text-blue-500" />}
                    <div>
                      <p className="text-xs font-medium capitalize">{t.waste_category} · Grade {t.grade} · {t.weight_kg}kg</p>
                      <p className="text-[10px] text-muted-foreground">{t.created_date ? format(new Date(t.created_date), 'dd MMM yyyy HH:mm') : '—'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${t.transaction_type === 'payout' ? 'text-green-600' : 'text-blue-600'}`}>
                      {t.transaction_type === 'payout' ? '+' : '-'}{(t.net_amount_ugx||0).toLocaleString()}
                    </p>
                    <Badge className={`text-[10px] ${t.payment_status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`} variant="secondary">
                      {t.payment_status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <Wallet className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Select a wallet to view history</p>
          </div>
        )}
      </div>
    </div>
  );
}