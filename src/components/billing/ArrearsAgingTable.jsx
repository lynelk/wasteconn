import { useMemo } from 'react';
import { differenceInDays } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';
import { buckets, getBucket } from '@/lib/arrears';

export default function ArrearsAgingTable({ invoices, customers }) {
  const isMobile = useIsMobile();
  const customerMap = useMemo(() => Object.fromEntries((customers || []).map(c => [c.id, c])), [customers]);

  const unpaid = invoices.filter(i => ['issued', 'overdue', 'partially_paid'].includes(i.status));

  const byBucket = buckets.map(b => ({
    ...b,
    invoices: unpaid.filter(i => getBucket(i) === b.label),
    total: unpaid.filter(i => getBucket(i) === b.label).reduce((s, i) => s + (i.amount_ugx || 0), 0),
  }));

  const grandTotal = unpaid.reduce((s, i) => s + (i.amount_ugx || 0), 0);

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className={`grid gap-2 ${isMobile ? 'grid-cols-3' : 'grid-cols-5'}`}>
        {byBucket.map(b => (
          <div key={b.label} className={`rounded-xl border px-3 py-3 text-center ${b.color.replace('text-', 'border-').replace(/\d+$/, '200')}`}>
            <div className={`text-xs font-semibold ${b.color.split(' ')[1]}`}>{b.label}</div>
            <div className="text-base font-bold font-jakarta mt-1">{b.invoices.length}</div>
            <div className="text-xs text-muted-foreground">{(b.total / 1000000).toFixed(2)}M UGX</div>
          </div>
        ))}
      </div>

      {/* Detail table */}
      {unpaid.length === 0 ? (
        <p className="text-center py-8 text-sm text-muted-foreground">No outstanding invoices — all accounts are current!</p>
      ) : isMobile ? (
        // Mobile card list
        <div className="space-y-2">
          {unpaid
            .sort((a, b) => differenceInDays(new Date(b.due_date || ''), new Date(a.due_date || '')))
            .map(inv => {
              const customer = customerMap[inv.customer_id];
              const bucket = getBucket(inv);
              const bucketStyle = buckets.find(b => b.label === bucket)?.color || 'bg-muted text-muted-foreground';
              return (
                <div key={inv.id} className="rounded-xl border border-border/60 bg-card px-4 py-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <p className="font-semibold text-sm">{customer?.full_name || '—'}</p>
                    <Badge variant="secondary" className={`text-xs ${bucketStyle}`}>{bucket}</Badge>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <div><dt className="text-[10px] text-muted-foreground uppercase">Invoice #</dt><dd className="text-xs font-mono">{inv.invoice_number}</dd></div>
                    <div><dt className="text-[10px] text-muted-foreground uppercase">Due Date</dt><dd className="text-xs">{inv.due_date}</dd></div>
                    <div><dt className="text-[10px] text-muted-foreground uppercase">Amount</dt><dd className="text-xs font-semibold">{(inv.amount_ugx || 0).toLocaleString()} UGX</dd></div>
                    <div><dt className="text-[10px] text-muted-foreground uppercase">Status</dt>
                      <dd><Badge variant="secondary" className={`text-[10px] px-1 ${inv.status === 'overdue' ? 'bg-red-100 text-red-700' : inv.status === 'partially_paid' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>{inv.status?.replace('_', ' ')}</Badge></dd>
                    </div>
                  </dl>
                </div>
              );
            })}
          <div className="rounded-xl bg-muted/30 px-4 py-3 flex justify-between text-sm">
            <span className="font-bold text-muted-foreground">TOTAL OUTSTANDING</span>
            <span className="font-bold text-destructive">{grandTotal.toLocaleString()} UGX</span>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 border-b border-border/60">
                {['Customer', 'Invoice #', 'Due Date', 'Amount (UGX)', 'Bucket', 'Status'].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {unpaid
                .sort((a, b) => differenceInDays(new Date(b.due_date || ''), new Date(a.due_date || '')))
                .map(inv => {
                  const customer = customerMap[inv.customer_id];
                  const bucket = getBucket(inv);
                  const bucketStyle = buckets.find(b => b.label === bucket)?.color || 'bg-muted text-muted-foreground';
                  return (
                    <tr key={inv.id} className="border-b border-border/40 hover:bg-muted/20">
                      <td className="px-4 py-3 text-sm font-medium">{customer?.full_name || '—'}</td>
                      <td className="px-4 py-3 text-xs font-mono">{inv.invoice_number}</td>
                      <td className="px-4 py-3 text-xs">{inv.due_date}</td>
                      <td className="px-4 py-3 text-sm font-semibold">{(inv.amount_ugx || 0).toLocaleString()}</td>
                      <td className="px-4 py-3"><Badge variant="secondary" className={`text-xs ${bucketStyle}`}>{bucket}</Badge></td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className={`text-xs ${inv.status === 'overdue' ? 'bg-red-100 text-red-700' : inv.status === 'partially_paid' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>
                          {inv.status?.replace('_', ' ')}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
            <tfoot>
              <tr className="bg-muted/30">
                <td colSpan={3} className="px-4 py-3 text-xs font-bold text-muted-foreground">TOTAL OUTSTANDING</td>
                <td className="px-4 py-3 text-sm font-bold text-destructive">{grandTotal.toLocaleString()} UGX</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}