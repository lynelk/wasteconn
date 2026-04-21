export interface Base44EntityClient<T> {
  list: (sort?: string, limit?: number) => Promise<T[]>;
  get?: (id: string) => Promise<T>;
  create?: (payload: Partial<T>) => Promise<T>;
  update?: (id: string, payload: Partial<T>) => Promise<T>;
  delete?: (id: string) => Promise<void>;
}

export interface Base44Client {
  auth: {
    me: () => Promise<unknown>;
    logout: (redirectUrl?: string) => void;
    redirectToLogin: (redirectUrl?: string) => void;
  };
  entities: Record<string, Base44EntityClient<unknown>>;
}
