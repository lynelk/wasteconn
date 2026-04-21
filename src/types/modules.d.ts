declare module '@/pages/*' {
  import type { ComponentType } from 'react';
  const Component: ComponentType;
  export default Component;
}

declare module '@/api/payments' {
  export const paymentsApi: {
    list: (params?: Record<string, string | number | boolean>) => Promise<import('@/api/types').Payment[]>;
    create: (payload: Partial<import('@/api/types').Payment>) => Promise<import('@/api/types').Payment>;
  };
}

declare module '@/api/pickups' {
  export const pickupsApi: {
    list: (params?: Record<string, string | number | boolean>) => Promise<import('@/api/types').Pickup[]>;
    create: (payload: Partial<import('@/api/types').Pickup>) => Promise<import('@/api/types').Pickup>;
  };
}

declare module '@/api/vehicles' {
  export const vehiclesApi: {
    list: (params?: Record<string, string | number | boolean>) => Promise<import('@/api/types').Vehicle[]>;
  };
}

declare module '@/api/auth' {
  export const authApi: {
    me: () => Promise<{ id: string; email?: string; role?: string }>;
  };
}

declare module '@/api/client' {
  export interface TypedApiClient {
    get: <T = unknown>(path: string, options?: Record<string, unknown>) => Promise<T>;
    post: <T = unknown>(path: string, body: unknown, options?: Record<string, unknown>) => Promise<T>;
    put: <T = unknown>(path: string, body: unknown, options?: Record<string, unknown>) => Promise<T>;
    patch: <T = unknown>(path: string, body: unknown, options?: Record<string, unknown>) => Promise<T>;
    delete: <T = unknown>(path: string, options?: Record<string, unknown>) => Promise<T>;
  }

  export const apiClient: TypedApiClient;
  export const createApiClient: (config?: { baseUrl?: string; retries?: number }) => TypedApiClient;
}

declare module '@/lib/errorHandler' {
  export class AppError extends Error {
    type: string;
    details?: unknown;
    constructor(type: string, message: string, details?: unknown);
  }

  export const ErrorTypes: {
    NETWORK: 'network_error';
    VALIDATION: 'validation_error';
    AUTH: 'auth_error';
    SERVER: 'server_error';
    UNKNOWN: 'unknown_error';
  };

  export const handleApiError: (error: unknown) => AppError;
}

declare module '@/lib/logger' {
  export const logger: {
    info: (event: string, meta?: Record<string, unknown>) => void;
    warn: (event: string, meta?: Record<string, unknown>) => void;
    error: (event: string, meta?: Record<string, unknown>) => void;
  };
}

declare module '@/lib/useSyncManager' {
  export interface SyncError {
    message: string;
    timestamp: string;
  }
  export function useSyncManager(): {
    isOnline: boolean;
    pendingCount: number;
    syncing: boolean;
    lastSyncAt: Date | null;
    syncNow: () => Promise<void>;
    syncError: SyncError | null;
  };
}

declare module '@/lib/offlineDB' {
  export function queueWBTransaction(data: Record<string, unknown>): Promise<void>;
  export function getPendingWBTransactions(): Promise<Record<string, unknown>[]>;
  export function markWBTransactionSynced(local_id: string): Promise<void>;
  export function clearSyncedWBTransactions(): Promise<void>;
  export function savePickupEvidence(pickupId: string, dataUrl: string, gps: unknown): Promise<void>;
  export function getEvidenceForPickup(pickupId: string): Promise<Record<string, unknown>[]>;
  export function cacheDriverJobs(jobs: Record<string, unknown>[]): Promise<void>;
  export function getCachedDriverJobs(): Promise<Record<string, unknown>[]>;
  export function updateCachedDriverJob(id: string, changes: Record<string, unknown>): Promise<void>;
  export function enqueueAction(entity: string, action: string, payload: Record<string, unknown>): Promise<void>;
  export function getPendingActions(): Promise<Record<string, unknown>[]>;
  export function markActionSynced(local_id: string): Promise<void>;
}

declare module '@/api/base44Client' {
  import type { Base44Client } from '@/types/base44';
  export const base44: Base44Client;
}

declare module '@/lib/AuthContext' {
  import type { ReactNode } from 'react';

  export interface AuthError {
    type: string;
    message: string;
  }

  export interface AuthContextValue {
    user: Record<string, unknown> | null;
    isAuthenticated: boolean;
    isLoadingAuth: boolean;
    isLoadingPublicSettings: boolean;
    authError: AuthError | null;
    appPublicSettings: Record<string, unknown> | null;
    logout: (shouldRedirect?: boolean) => void;
    navigateToLogin: () => void;
    checkAppState: () => Promise<void>;
  }

  export function AuthProvider(props: { children: ReactNode }): JSX.Element;
  export function useAuth(): AuthContextValue;
}

declare module '@/components/ProtectedRoute' {
  import type { ReactElement } from 'react';

  interface ProtectedRouteProps {
    fallback?: ReactElement;
    unauthenticatedElement?: ReactElement;
  }

  export default function ProtectedRoute(props: ProtectedRouteProps): JSX.Element | null;
}

