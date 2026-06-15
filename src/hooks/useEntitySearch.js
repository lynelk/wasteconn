import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { clampLimit, dedupeById, DEFAULT_PAGE_SIZE } from '@/lib/pagination';

// Bounded, server-side search over a Base44 entity — the scalable replacement
// for `entity.list()` dropdowns that load every row.
//
// Base44 supports MongoDB-style operators, so we push search to the server:
//   - empty query  -> a bounded recent page (`list(sort, limit)`)
//   - typed query  -> `filter({ $or: [{ field: { $regex } }, ...] }, sort, limit)`
// Nothing ever fetches an unbounded table.

// Escape user input so it is treated as a literal substring, not a pattern.
export function escapeRegex(input = '') {
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Pure helper (unit-tested): build the server $or/$regex query for a search term.
// Returns null for an empty term (caller should use a plain recent list).
export function buildSearchQuery(searchFields, term) {
  const q = (term || '').trim();
  if (!q) return null;
  // Inline (?i) makes the regex case-insensitive (PCRE flag).
  const rx = `(?i)${escapeRegex(q)}`;
  const clauses = searchFields.map((f) => ({ [f]: { $regex: rx } }));
  return clauses.length === 1 ? clauses[0] : { $or: clauses };
}

// Pure helper (unit-tested): dedupe + cap candidate rows.
export function filterCandidates(rows, limit = DEFAULT_PAGE_SIZE) {
  return dedupeById(rows).slice(0, clampLimit(limit));
}

export function useEntitySearch({
  entity,
  searchFields = ['full_name'],
  sort = '-created_date',
  limit = DEFAULT_PAGE_SIZE,
  enabled = true,
}) {
  const [query, setQuery] = useState('');
  const cap = clampLimit(limit);
  const q = query.trim();
  const available = enabled && !!base44.entities[entity];

  const recent = useQuery({
    queryKey: ['entity-search', entity, 'recent', sort, cap],
    queryFn: () => base44.entities[entity].list(sort, cap),
    enabled: available && q.length === 0,
    staleTime: 60_000,
  });

  const searched = useQuery({
    queryKey: ['entity-search', entity, 'q', q, searchFields, sort, cap],
    queryFn: () => base44.entities[entity].filter(buildSearchQuery(searchFields, q), sort, cap),
    enabled: available && q.length > 0,
    staleTime: 60_000,
  });

  const active = q.length > 0 ? searched : recent;
  const options = useMemo(() => filterCandidates(active.data || [], cap), [active.data, cap]);

  return { query, setQuery, options, isLoading: active.isLoading || active.isFetching };
}
