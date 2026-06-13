import { describe, it, expect } from 'vitest';
import { computeCollectionsKpis, formatUGX } from '@/lib/collectionsKpis';

const NOW = new Date('2026-06-13T12:00:00Z');

describe('computeCollectionsKpis', () => {
  const completed = [
    { amount_ugx: 50000, status: 'completed' },
    { amount_ugx: 30000, status: 'completed' },
  ];
  const invoices = [
    { customer_id: 'c1', amount_ugx: 100000, status: 'paid', issue_date: '2026-06-01', paid_date: '2026-06-05' },
    { customer_id: 'c2', amount_ugx: 60000, status: 'overdue', issue_date: '2026-06-02' },
    { customer_id: 'c2', amount_ugx: 40000, status: 'issued', issue_date: '2026-06-10' },
    { customer_id: 'c3', amount_ugx: 20000, status: 'paid', issue_date: '2025-01-01', paid_date: '2025-01-15' }, // out of range
  ];

  it('sums collected and counts payments', () => {
    const kpis = computeCollectionsKpis(completed, invoices, 30, NOW);
    expect(kpis.totalCollected).toBe(80000);
    expect(kpis.paidCount).toBe(2);
  });

  it('computes collection rate against in-range invoiced total', () => {
    const kpis = computeCollectionsKpis(completed, invoices, 30, NOW);
    expect(kpis.totalInvoiced).toBe(200000); // excludes 2025 invoice
    expect(kpis.collectionRate).toBe(40);
  });

  it('computes avg days to pay from paid invoices in range', () => {
    const kpis = computeCollectionsKpis(completed, invoices, 30, NOW);
    expect(kpis.avgDaysToPay).toBe(4);
  });

  it('finds the largest debtor across all unpaid invoices', () => {
    const kpis = computeCollectionsKpis(completed, invoices, 30, NOW);
    expect(kpis.topDebtorAmount).toBe(100000); // c2: 60k + 40k
  });

  it('returns nulls when there is no invoice data', () => {
    const kpis = computeCollectionsKpis([], [], 30, NOW);
    expect(kpis.collectionRate).toBeNull();
    expect(kpis.avgDaysToPay).toBeNull();
    expect(kpis.totalCollected).toBe(0);
    expect(kpis.topDebtorAmount).toBe(0);
  });
});

describe('formatUGX', () => {
  it('formats millions, thousands and small values', () => {
    expect(formatUGX(2_500_000)).toBe('2.5M');
    expect(formatUGX(45_000)).toBe('45K');
    expect(formatUGX(500)).toBe('500');
  });
});
