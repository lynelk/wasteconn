import { describe, it, expect } from 'vitest';
import { escapeRegex, buildSearchQuery, filterCandidates, matchCachedEntities } from '@/hooks/useEntitySearch';

describe('escapeRegex', () => {
  it('escapes regex metacharacters', () => {
    expect(escapeRegex('a.b*c')).toBe('a\\.b\\*c');
    expect(escapeRegex('(x)[y]')).toBe('\\(x\\)\\[y\\]');
  });
});

describe('buildSearchQuery', () => {
  it('returns null for empty/whitespace terms', () => {
    expect(buildSearchQuery(['full_name'], '')).toBeNull();
    expect(buildSearchQuery(['full_name'], '   ')).toBeNull();
  });

  it('builds a case-insensitive regex clause for a single field', () => {
    expect(buildSearchQuery(['full_name'], 'alice')).toEqual({
      full_name: { $regex: '(?i)alice' },
    });
  });

  it('builds an $or across multiple fields and escapes input', () => {
    expect(buildSearchQuery(['full_name', 'phone'], 'a.b')).toEqual({
      $or: [
        { full_name: { $regex: '(?i)a\\.b' } },
        { phone: { $regex: '(?i)a\\.b' } },
      ],
    });
  });
});

describe('filterCandidates', () => {
  const rows = [
    { id: '1', full_name: 'Alice' },
    { id: '2', full_name: 'Bob' },
    { id: '1', full_name: 'Alice' }, // dup id
    { id: '3', full_name: 'Carol' },
  ];

  it('dedupes by id preserving order', () => {
    expect(filterCandidates(rows).map((r) => r.id)).toEqual(['1', '2', '3']);
  });

  it('caps the result set', () => {
    expect(filterCandidates(rows, 2)).toHaveLength(2);
  });
});

describe('matchCachedEntities (offline search)', () => {
  const rows = [
    { id: '1', full_name: 'Alice Doe', phone: '0700111' },
    { id: '2', full_name: 'Bob Smith', phone: '0700222' },
    { id: '3', full_name: 'Carol Jones', phone: '0800333' },
  ];

  it('returns all (deduped/capped) for an empty term', () => {
    expect(matchCachedEntities(rows, ['full_name'], '').map(r => r.id)).toEqual(['1', '2', '3']);
  });

  it('matches case-insensitively across search fields', () => {
    expect(matchCachedEntities(rows, ['full_name', 'phone'], 'bob').map(r => r.id)).toEqual(['2']);
    expect(matchCachedEntities(rows, ['full_name', 'phone'], '0800').map(r => r.id)).toEqual(['3']);
  });

  it('returns nothing when the cache is empty', () => {
    expect(matchCachedEntities([], ['full_name'], 'alice')).toEqual([]);
  });

  it('caps results', () => {
    expect(matchCachedEntities(rows, ['full_name'], '', 2)).toHaveLength(2);
  });
});
