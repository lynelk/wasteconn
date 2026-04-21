export interface QueryOptions {
  enabled?: boolean;
  staleTime?: number;
}

export interface MutationResult<TData = unknown> {
  data?: TData;
  error?: Error | null;
  isPending: boolean;
}
