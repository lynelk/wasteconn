import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { clampLimit, dedupeById, DEFAULT_PAGE_SIZE } from '@/lib/pagination';
import { cacheEntities, getCachedEntities } from '@/lib/offlineDB';

// Bounded, server-side search over a Base44 entity — the scalable replacement
// for `entity.list()` dropdowns that load every row.
//
// Base44 supports MongoDB-style operators, so we push search to the server:
//   - empty query  -> a bounded recent page (`list(sort, limit)`)
//   - typed query  -> `filter({ $or: [{ field: { $regex } }, ...] }, sort, limit)`
// Nothing ever fetches an unbounded table.
//
// Offline fallback: rows fetched online are cached in IndexedDB, and when the
// device is offline the search runs against that cache instead. This keeps
// offline-capable forms (e.g. the WasteBank transaction form) usable — without
// it, an async picker can't resolve a required id like customer_id offline.

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

// Pure helper (unit-tested): client-side substring match over searchFields,
// used for the offline cache path (mirrors the server $regex query).
export function matchCachedEntities(rows = [], searchFields = [], term = '', limit = DEFAULT_PAGE_SIZE) {
  const q = (term || '').trim().toLowerCase();
  const matched = !q
    ? rows
    : rows.filter((r) => searchFields.some((f) => String(r?.[f] ?? '').toLowerCase().includes(q)));
  return filterCandidates(matched, limit);
}

export function useEntitySearch({
  entity,
  searchFields = ['full_name'],
  sort = '-created_date',
  limit = DEFAULT_PAGE_SIZE,
  enabled = true,
}) {
  const { user } = useAuth();
  const scope = user?.tenant_id || '';
  const [query, setQuery] = useState('');
  const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const cap = clampLimit(limit);
  const q = query.trim();
  const available = enabled && !!base44.entities[entity];

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const recent = useQuery({
    queryKey: ['entity-search', entity, 'recent', sort, cap],
    queryFn: () => base44.entities[entity].list(sort, cap),
    enabled: available && isOnline && q.length === 0,
    staleTime: 60_000,
  });

  const searched = useQuery({
    queryKey: ['entity-search', entity, 'q', q, searchFields, sort, cap],
    queryFn: () => base44.entities[entity].filter(buildSearchQuery(searchFields, q), sort, cap),
    enabled: available && isOnline && q.length > 0,
    staleTime: 60_000,
  });

  // Offline: search the locally-cached rows for this entity (tenant-scoped).
  const cached = useQuery({
    queryKey: ['entity-search-offline', scope, entity],
    queryFn: () => getCachedEntities(entity, scope),
    enabled: available && !isOnline,
    staleTime: 60_000,
  });

  const serverActive = q.length > 0 ? searched : recent;

  // Persist whatever the server returned so it's available offline next time.
  useEffect(() => {
    if (isOnline && Array.isArray(serverActive.data) && serverActive.data.length) {
      cacheEntities(entity, serverActive.data, scope);
    }
  }, [isOnline, entity, scope, serverActive.data]);

  const options = useMemo(() => {
    if (!isOnline) return matchCachedEntities(cached.data || [], searchFields, q, cap);
    return filterCandidates(serverActive.data || [], cap);
  }, [isOnline, cached.data, serverActive.data, searchFields, q, cap]);

  return {
    query,
    setQuery,
    options,
    isLoading: isOnline ? (serverActive.isLoading || serverActive.isFetching) : cached.isLoading,
    isOffline: !isOnline,
  };
}
