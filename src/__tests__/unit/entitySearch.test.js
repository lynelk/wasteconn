import { describe, it, expect } from 'vitest';
import { escapeRegex, buildSearchQuery, filterCandidates } from '@/hooks/useEntitySearch';

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
