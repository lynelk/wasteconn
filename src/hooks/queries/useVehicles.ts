import { useQuery } from '@tanstack/react-query';
import { vehiclesApi } from '@/api/vehicles';

const VEHICLES_KEY = ['vehicles'];

export const useVehicles = () => {
  return useQuery({
    queryKey: VEHICLES_KEY,
    queryFn: () => vehiclesApi.list(),
    staleTime: 120_000
  });
};
