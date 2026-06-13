import { subDays, parseISO, isAfter, differenceInDays } from 'date-fns';

// Pure collections KPI computation, extracted for unit testing.
// completed: payments with status=completed already filtered to the range
// invoices: all invoices (range filtering happens here for invoiced totals)
export function computeCollectionsKpis(completed, invoices, rangeDays, now = new Date()) {
  const totalCollected = completed.reduce((s, p) => s + (p.amount_ugx || 0), 0);

  const cutoff = subDays(now, rangeDays);
  const rangeInvoices = invoices.filter(inv => inv.issue_date && isAfter(parseISO(inv.issue_date), cutoff));
  const totalInvoiced = rangeInvoices.reduce((s, i) => s + (i.amount_ugx || 0), 0);
  const collectionRate = totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 100) : null;

  const paidInvoices = rangeInvoices.filter(i => i.status === 'paid' && i.issue_date && i.paid_date);
  const avgDaysToPay = paidInvoices.length > 0
    ? Math.round(paidInvoices.reduce((s, i) => s + differenceInDays(new Date(i.paid_date), new Date(i.issue_date)), 0) / paidInvoices.length)
    : null;

  const debtorMap = {};
  invoices
    .filter(i => ['issued', 'overdue', 'partially_paid'].includes(i.status))
    .forEach(i => {
      debtorMap[i.customer_id] = (debtorMap[i.customer_id] || 0) + (i.amount_ugx || 0);
    });
  const topDebtorAmount = Math.max(0, ...Object.values(debtorMap));

  return { totalCollected, totalInvoiced, collectionRate, avgDaysToPay, topDebtorAmount, paidCount: completed.length };
}

export const formatUGX = (v) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v);
