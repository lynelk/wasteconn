import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { paymentsApi } from '@/api/payments';

const PAYMENTS_KEY = ['payments'];

export const usePayments = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: PAYMENTS_KEY,
    queryFn: () => paymentsApi.list(),
    staleTime: 60_000
  });

  const createMutation = useMutation({
    mutationFn: paymentsApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PAYMENTS_KEY })
  });

  return { ...query, createPayment: createMutation };
};
