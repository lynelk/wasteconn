import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { Customer } from '@/api/types';

const CUSTOMERS_KEY = ['customers'];

type CustomerResponse = { data?: Customer[] } | Customer[];

export const useCustomers = () => {
  return useQuery({
    queryKey: CUSTOMERS_KEY,
    queryFn: async () => {
      const result = await apiClient.get<CustomerResponse>('/customers');
      return Array.isArray(result) ? result : result?.data ?? [];
    },
    staleTime: 60_000
  });
};
