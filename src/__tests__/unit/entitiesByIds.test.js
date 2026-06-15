import { describe, it, expect } from 'vitest';
import { chunkIds } from '@/hooks/useEntitiesByIds';

describe('chunkIds', () => {
  it('dedupes and drops falsy ids', () => {
    expect(chunkIds(['a', 'a', null, 'b', undefined, ''])).toEqual([['a', 'b']]);
  });

  it('splits into bounded chunks', () => {
    const ids = Array.from({ length: 450 }, (_, i) => `id${i}`);
    const chunks = chunkIds(ids, 200);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(200);
    expect(chunks[2]).toHaveLength(50);
  });

  it('returns no chunks for an empty list', () => {
    expect(chunkIds([])).toEqual([]);
  });
});
