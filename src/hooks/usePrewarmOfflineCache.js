import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { cacheEntities } from '@/lib/offlineDB';
import { ANALYTICS_SCAN_LIMIT } from '@/lib/pagination';

// Pre-warm the offline entity cache so async pickers (EntitySelect) work even on
// a cold offline start — i.e. an agent who opens the app already offline can
// still select a customer. Without this, the cache is only populated once a
// picker has been opened online.
//
// React Query's online manager pauses this query while offline and resumes it
// automatically on reconnect, so we don't gate on a (non-reactive)
// navigator.onLine. Rows are cached under the current tenant so a shared device
// never surfaces another tenant's customers offline.

const WARM_LIMIT = Math.min(ANALYTICS_SCAN_LIMIT, 2000);

export function usePrewarmOfflineCache({ enabled = true } = {}) {
  const { user } = useAuth();
  const scope = user?.tenant_id || '';

  const { data } = useQuery({
    queryKey: ['prewarm-offline', scope, 'Customer'],
    queryFn: () => base44.entities.Customer.filter({ status: 'active' }, '-created_date', WARM_LIMIT),
    enabled,
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  useEffect(() => {
    if (Array.isArray(data) && data.length) cacheEntities('Customer', data, scope);
  }, [data, scope]);
}
