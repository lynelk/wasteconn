declare module '@/pages/*' {
  import type { ComponentType } from 'react';
  const Component: ComponentType;
  export default Component;
}

declare module '@/api/payments' {
  export const paymentsApi: {
    list: (params?: Record<string, string | number | boolean>) => Promise<any[]>;
    create: (payload: unknown) => Promise<any>;
  };
}

declare module '@/api/pickups' {
  export const pickupsApi: {
    list: (params?: Record<string, string | number | boolean>) => Promise<any[]>;
    create: (payload: unknown) => Promise<any>;
  };
}

declare module '@/api/vehicles' {
  export const vehiclesApi: {
    list: (params?: Record<string, string | number | boolean>) => Promise<any[]>;
  };
}

declare module '@/api/auth' {
  export const authApi: {
    me: () => Promise<any>;
  };
}

declare module '@/api/client' {
  export const apiClient: {
    get: (path: string, options?: Record<string, unknown>) => Promise<any>;
    post: (path: string, body: unknown, options?: Record<string, unknown>) => Promise<any>;
    put: (path: string, body: unknown, options?: Record<string, unknown>) => Promise<any>;
    patch: (path: string, body: unknown, options?: Record<string, unknown>) => Promise<any>;
    delete: (path: string, options?: Record<string, unknown>) => Promise<any>;
  };
}

declare module '@/lib/errorHandler' {
  export const ErrorTypes: Record<string, string>;
  export const handleApiError: (error: any) => any;
}
