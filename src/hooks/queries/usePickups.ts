import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pickupsApi } from '@/api/pickups';

const PICKUPS_KEY = ['pickups'];

export const usePickups = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: PICKUPS_KEY,
    queryFn: () => pickupsApi.list(),
    staleTime: 30_000
  });

  const createMutation = useMutation({
    mutationFn: pickupsApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PICKUPS_KEY })
  });

  return { ...query, createPickup: createMutation };
};
