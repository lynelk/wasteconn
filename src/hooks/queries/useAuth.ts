import { useQuery } from '@tanstack/react-query';
import { authApi } from '@/api/auth';

const AUTH_KEY = ['auth', 'me'];

export const useAuthQuery = () => {
  return useQuery({
    queryKey: AUTH_KEY,
    queryFn: () => authApi.me(),
    staleTime: 300_000,
    retry: false
  });
};
