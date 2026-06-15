import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

// Fetch only the entity rows referenced by a bounded list (id -> row map),
// instead of loading the whole table to resolve names. Scalable replacement for
// the "load all customers/service-points to label a list" anti-pattern.

const CHUNK_SIZE = 200;

// Pure helper (unit-tested): unique, truthy ids split into bounded chunks.
export function chunkIds(ids = [], size = CHUNK_SIZE) {
  const unique = [...new Set(ids.filter(Boolean))];
  const chunks = [];
  for (let i = 0; i < unique.length; i += size) {
    chunks.push(unique.slice(i, i + size));
  }
  return chunks;
}

export function useEntitiesByIds(entity, ids = []) {
  const chunks = chunkIds(ids);
  const flatIds = chunks.flat();

  const query = useQuery({
    queryKey: ['entities-by-ids', entity, flatIds],
    queryFn: async () => {
      const results = await Promise.all(
        chunks.map((chunk) =>
          base44.entities[entity].filter({ id: { $in: chunk } }, undefined, chunk.length).catch(() => [])
        )
      );
      return results.flat();
    },
    enabled: flatIds.length > 0 && !!base44.entities[entity],
    staleTime: 60_000,
  });

  const rows = query.data || [];
  const map = Object.fromEntries(rows.map((r) => [r.id, r]));
  return { ...query, rows, map };
}
