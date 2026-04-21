import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSyncManager } from '@/lib/useSyncManager';

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@/lib/offlineDB', () => ({
  getPendingWBTransactions: vi.fn().mockResolvedValue([]),
  markWBTransactionSynced: vi.fn().mockResolvedValue(undefined),
  clearSyncedWBTransactions: vi.fn().mockResolvedValue(undefined),
  getPendingActions: vi.fn().mockResolvedValue([]),
  markActionSynced: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/api/base44Client', () => ({
  base44: {
    entities: {
      WasteBankTransaction: { create: vi.fn().mockResolvedValue({}) },
      PickupRequest: { update: vi.fn().mockResolvedValue({}) },
      Ticket: { create: vi.fn().mockResolvedValue({}) },
      ExceptionQueue: { create: vi.fn().mockResolvedValue({}) },
    },
  },
}));

// Silence logger output during tests
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

const offlineDB = await import('@/lib/offlineDB');

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useSyncManager', () => {
  beforeEach(() => {
    // Clear call counts but preserve mockResolvedValue implementations
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initialises with no syncError', () => {
    const { result } = renderHook(() => useSyncManager());
    expect(result.current.syncError).toBeNull();
  });

  it('initialises with syncing=false', () => {
    const { result } = renderHook(() => useSyncManager());
    expect(result.current.syncing).toBe(false);
  });

  it('sets syncError when syncAll throws', async () => {
    const { result } = renderHook(() => useSyncManager());

    // Let initial useEffect (countPending) settle with the default [] mock
    await act(async () => {});

    // Queue a rejection for the upcoming syncNow call
    vi.mocked(offlineDB.getPendingWBTransactions).mockRejectedValueOnce(
      new Error('IndexedDB unavailable')
    );

    await act(async () => {
      await result.current.syncNow();
    });

    expect(result.current.syncError).not.toBeNull();
    expect(result.current.syncError?.message).toBe('IndexedDB unavailable');
    expect(result.current.syncError?.timestamp).toBeDefined();
  });

  it('clears syncError on a successful subsequent sync', async () => {
    const { result } = renderHook(() => useSyncManager());
    await act(async () => {});

    // First call fails
    vi.mocked(offlineDB.getPendingWBTransactions).mockRejectedValueOnce(new Error('first failure'));
    await act(async () => {
      await result.current.syncNow();
    });
    expect(result.current.syncError).not.toBeNull();

    // Second call succeeds (default mock returns [])
    await act(async () => {
      await result.current.syncNow();
    });
    expect(result.current.syncError).toBeNull();
  });

  it('exposes pendingCount based on queued records', async () => {
    vi.mocked(offlineDB.getPendingWBTransactions).mockResolvedValue([{ local_id: '1' }] as never);
    vi.mocked(offlineDB.getPendingActions).mockResolvedValue([{ local_id: '2' }] as never);

    const { result } = renderHook(() => useSyncManager());

    // countPending is called during mount via useEffect
    await act(async () => {});

    expect(result.current.pendingCount).toBe(2);
  });

  it('does not attempt sync when offline', async () => {
    const { result } = renderHook(() => useSyncManager());

    // Let initial effects settle
    await act(async () => {});

    // Clear call records from mount-time countPending
    vi.clearAllMocks();

    // Go offline, then attempt sync
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    await act(async () => {
      await result.current.syncNow();
    });

    expect(offlineDB.getPendingWBTransactions).not.toHaveBeenCalled();
    expect(result.current.syncError).toBeNull();
  });
});

