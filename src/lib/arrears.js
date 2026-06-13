import { differenceInDays } from 'date-fns';

export const buckets = [
  { label: 'Current', max: 0, color: 'bg-green-100 text-green-700' },
  { label: '1–30 days', min: 1, max: 30, color: 'bg-yellow-100 text-yellow-700' },
  { label: '31–60 days', min: 31, max: 60, color: 'bg-orange-100 text-orange-700' },
  { label: '61–90 days', min: 61, max: 90, color: 'bg-red-100 text-red-700' },
  { label: '90+ days', min: 91, color: 'bg-red-200 text-red-800' },
];

export function getBucket(invoice, now = new Date()) {
  if (!invoice.due_date || invoice.status === 'paid') return 'paid';
  const days = differenceInDays(now, new Date(invoice.due_date));
  if (days <= 0) return 'Current';
  if (days <= 30) return '1–30 days';
  if (days <= 60) return '31–60 days';
  if (days <= 90) return '61–90 days';
  return '90+ days';
}
