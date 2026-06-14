import { describe, it, expect } from 'vitest';
import { filterCandidates } from '@/hooks/useEntitySearch';

const rows = [
  { id: '1', full_name: 'Alice Mukasa', phone: '+256700000001' },
  { id: '2', full_name: 'Bob Okello', phone: '+256700000002' },
  { id: '1', full_name: 'Alice Mukasa', phone: '+256700000001' }, // dup id
  { id: '3', full_name: 'Carol Nakato', phone: '+256700000003' },
];

describe('filterCandidates', () => {
  it('dedupes by id and returns bounded recent set when no query', () => {
    const out = filterCandidates(rows, '', ['full_name', 'phone']);
    expect(out.map(r => r.id)).toEqual(['1', '2', '3']);
  });

  it('matches by substring across fields, case-insensitive', () => {
    expect(filterCandidates(rows, 'alice', ['full_name']).map(r => r.id)).toEqual(['1']);
    expect(filterCandidates(rows, 'NAKATO', ['full_name']).map(r => r.id)).toEqual(['3']);
    expect(filterCandidates(rows, '000002', ['phone']).map(r => r.id)).toEqual(['2']);
  });

  it('respects the limit cap', () => {
    expect(filterCandidates(rows, '', ['full_name'], 2)).toHaveLength(2);
  });

  it('returns empty when nothing matches', () => {
    expect(filterCandidates(rows, 'zzz', ['full_name'])).toEqual([]);
  });
});
