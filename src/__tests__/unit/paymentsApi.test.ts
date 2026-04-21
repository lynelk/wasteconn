import { beforeEach, describe, expect, it, vi } from 'vitest';
import { paymentsApi } from '@/api/payments';

describe('paymentsApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('validates list response payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ data: [{ id: 'p1', amount: 100, status: 'paid' }] })
      })
    );

    await expect(paymentsApi.list()).resolves.toEqual([{ id: 'p1', amount: 100, status: 'paid' }]);
  });
});
