import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';

// Resolves the Customer record linked to the signed-in user (matched by email).
// Shared by the in-app customer self-service pages (My Pickups / Payments / Complaints).
export function useMyCustomer() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-customer', user?.email],
    queryFn: () => base44.entities.Customer.filter({ email: user?.email }),
    select: (data) => data?.[0] || null,
    enabled: !!user?.email,
  });
}
