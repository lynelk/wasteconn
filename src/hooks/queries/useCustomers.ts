import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';

const CUSTOMERS_KEY = ['customers'];

export const useCustomers = () => {
  return useQuery({
    queryKey: CUSTOMERS_KEY,
    queryFn: async () => {
      const result = await apiClient.get('/customers');
      return result?.data ?? result ?? [];
    },
    staleTime: 60_000
  });
};
