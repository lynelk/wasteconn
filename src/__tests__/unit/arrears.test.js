import { describe, it, expect } from 'vitest';
import { buckets, getBucket } from '@/lib/arrears';

const NOW = new Date('2026-06-13T12:00:00Z');

describe('arrears buckets', () => {
  it('defines 5 aging buckets', () => {
    expect(buckets.map(b => b.label)).toEqual(['Current', '1–30 days', '31–60 days', '61–90 days', '90+ days']);
  });

  it('returns paid for paid invoices', () => {
    expect(getBucket({ status: 'paid', due_date: '2026-01-01' }, NOW)).toBe('paid');
  });

  it('returns paid when due_date missing', () => {
    expect(getBucket({ status: 'issued' }, NOW)).toBe('paid');
  });

  it('returns Current for invoices not yet due', () => {
    expect(getBucket({ status: 'issued', due_date: '2026-06-20' }, NOW)).toBe('Current');
    expect(getBucket({ status: 'issued', due_date: '2026-06-13' }, NOW)).toBe('Current');
  });

  it('buckets by days overdue', () => {
    expect(getBucket({ status: 'overdue', due_date: '2026-06-01' }, NOW)).toBe('1–30 days');
    expect(getBucket({ status: 'overdue', due_date: '2026-05-01' }, NOW)).toBe('31–60 days');
    expect(getBucket({ status: 'overdue', due_date: '2026-04-01' }, NOW)).toBe('61–90 days');
    expect(getBucket({ status: 'overdue', due_date: '2026-01-01' }, NOW)).toBe('90+ days');
  });

  it('handles bucket boundaries exactly', () => {
    expect(getBucket({ status: 'overdue', due_date: '2026-05-14' }, NOW)).toBe('1–30 days'); // 30 days
    expect(getBucket({ status: 'overdue', due_date: '2026-05-13' }, NOW)).toBe('31–60 days'); // 31 days
  });
});
