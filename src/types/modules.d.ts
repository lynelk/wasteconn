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
