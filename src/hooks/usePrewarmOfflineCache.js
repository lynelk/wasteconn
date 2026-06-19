import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { cacheEntities } from '@/lib/offlineDB';
import { ANALYTICS_SCAN_LIMIT } from '@/lib/pagination';

// Pre-warm the offline entity cache so async pickers (EntitySelect) work even on
// a cold offline start — i.e. an agent who opens the app already offline can
// still select a customer. Without this, the cache is only populated once a
// picker has been opened online.
//
// Runs once while online (per session, deduped by react-query) and writes the
// tenant's active customers into IndexedDB via cacheEntities. Skipped for the
// customer role, which never picks from the customer list.

const WARM_LIMIT = Math.min(ANALYTICS_SCAN_LIMIT, 2000);

export function usePrewarmOfflineCache({ enabled = true } = {}) {
  const online = typeof navigator === 'undefined' ? true : navigator.onLine;

  const { data } = useQuery({
    queryKey: ['prewarm-offline', 'Customer'],
    queryFn: () => base44.entities.Customer.filter({ status: 'active' }, '-created_date', WARM_LIMIT),
    enabled: enabled && online,
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  useEffect(() => {
    if (Array.isArray(data) && data.length) cacheEntities('Customer', data);
  }, [data]);
}
