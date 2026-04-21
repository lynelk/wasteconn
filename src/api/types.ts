export interface ApiErrorPayload {
  code?: string;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  meta?: Record<string, unknown>;
}

export interface PaginationRequest {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: {
    total: number;
    page: number;
    limit: number;
    hasNextPage: boolean;
  };
}

export interface Payment {
  id: string;
  customer_id?: string;
  amount: number;
  currency?: string;
  status: string;
  created_date?: string;
}

export interface Pickup {
  id: string;
  customer_id?: string;
  status: string;
  scheduled_date?: string;
  created_date?: string;
}

export interface Vehicle {
  id: string;
  plate_number?: string;
  status: string;
  created_date?: string;
}

export interface Customer {
  id: string;
  full_name?: string;
  email?: string;
  created_date?: string;
}
