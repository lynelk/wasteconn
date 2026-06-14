import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { clampLimit, dedupeById, DEFAULT_PAGE_SIZE } from '@/lib/pagination';

// Bounded, debounced search over a Base44 entity — the scalable replacement for
// `entity.list()` dropdowns that load every row.
//
// Strategy (degrades safely regardless of backend search support):
//   1. Always fetch a bounded "recent" page (sorted), so the picker is usable
//      with no query and never pulls the whole table.
//   2. When the user types, additionally fetch exact-match server hits per
//      searchField, then client-filter everything by substring.
//
// This is strictly better than an unbounded list: it caps reads, and matches at
// least the recent page + any exact server hits. Wire backend full-text search
// into the `filter` calls here once available for complete coverage.

// Pure helper (unit-tested): rank/limit candidate rows by substring match.
export function filterCandidates(rows, query, fields, limit = DEFAULT_PAGE_SIZE) {
  const cap = clampLimit(limit);
  const deduped = dedupeById(rows);
  const q = (query || '').trim().toLowerCase();
  if (!q) return deduped.slice(0, cap);
  const matches = deduped.filter((r) =>
    fields.some((f) => String(r?.[f] ?? '').toLowerCase().includes(q))
  );
  return matches.slice(0, cap);
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

  const recent = useQuery({
    queryKey: ['entity-search', entity, 'recent', sort, cap],
    queryFn: () => base44.entities[entity].list(sort, cap),
    enabled: enabled && !!base44.entities[entity],
    staleTime: 60_000,
  });

  const q = query.trim();
  const serverHits = useQuery({
    queryKey: ['entity-search', entity, 'q', q, searchFields, cap],
    // Exact-match server lookups for each search field (best-effort).
    queryFn: async () => {
      const results = await Promise.all(
        searchFields.map((f) => base44.entities[entity].filter({ [f]: q }, sort, cap).catch(() => []))
      );
      return results.flat();
    },
    enabled: enabled && q.length > 0 && !!base44.entities[entity],
    staleTime: 60_000,
  });

  const options = useMemo(
    () => filterCandidates([...(serverHits.data || []), ...(recent.data || [])], query, searchFields, cap),
    [serverHits.data, recent.data, query, searchFields, cap]
  );

  return {
    query,
    setQuery,
    options,
    isLoading: recent.isLoading || serverHits.isFetching,
  };
}
