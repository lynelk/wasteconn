import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Truck, Plus, MapPin, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useMyCustomer } from '@/hooks/useMyCustomer';
import CustomerPickupModal from '@/components/customer/CustomerPickupModal';
import TrackDispatchModal from '@/components/customer/TrackDispatchModal';

const statusColor = {
  pending: 'bg-yellow-100 text-yellow-700',
  assigned: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function MyPickups() {
  const queryClient = useQueryClient();
  const { data: customer, isLoading: loadingCustomer } = useMyCustomer();
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [trackingPickup, setTrackingPickup] = useState(null);

  const { data: pickups = [], isLoading } = useQuery({
    queryKey: ['my-pickups', customer?.id],
    queryFn: () => base44.entities.PickupRequest.filter({ customer_id: customer?.id }),
    enabled: !!customer?.id,
  });

  const { data: servicePoints = [] } = useQuery({
    queryKey: ['my-service-points', customer?.id],
    queryFn: () => base44.entities.ServicePoint.filter({ customer_id: customer?.id }),
    enabled: !!customer?.id,
  });

  const requestPickupMutation = useMutation({
    mutationFn: (data) => base44.entities.PickupRequest.create({
      ...data,
      customer_id: customer.id,
      tenant_id: customer.tenant_id,
      request_type: 'on_demand',
      status: 'pending',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-pickups'] });
      setShowPickupModal(false);
    },
  });

  const recentPickups = [...pickups].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  const completedCount = pickups.filter(p => p.status === 'completed').length;
  const pendingCount = pickups.filter(p => ['pending', 'assigned', 'in_progress'].includes(p.status)).length;

  if (!loadingCustomer && !customer) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <UserX className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p>No customer account is linked to your profile.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-jakarta">My Pickups</h1>
          <p className="text-muted-foreground text-sm mt-1">{pendingCount} active · {completedCount} completed</p>
        </div>
        <Button onClick={() => setShowPickupModal(true)} disabled={!customer} className="gap-2">
          <Plus className="w-4 h-4" /> Request Pickup
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : recentPickups.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Truck className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No pickups yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recentPickups.map(pickup => (
            <Card key={pickup.id} className="border-border/60">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium capitalize">
                      {pickup.waste_type} waste · {pickup.request_type?.replace('_', ' ')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{pickup.address || 'Address on file'}</p>
                    {pickup.scheduled_date && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        📅 {format(new Date(pickup.scheduled_date), 'MMM d, yyyy')}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge className={`text-xs ${statusColor[pickup.status] || ''}`} variant="secondary">
                      {pickup.status?.replace('_', ' ')}
                    </Badge>
                    {(pickup.status === 'assigned' || pickup.status === 'in_progress') && pickup.assigned_driver_id && (
                      <button
                        onClick={() => setTrackingPickup(pickup)}
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        <MapPin className="w-3 h-3" /> Track driver
                      </button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {trackingPickup && (
        <TrackDispatchModal pickup={trackingPickup} onClose={() => setTrackingPickup(null)} />
      )}

      {showPickupModal && (
        <CustomerPickupModal
          servicePoints={servicePoints}
          customer={customer}
          onSubmit={(data) => requestPickupMutation.mutate(data)}
          onClose={() => setShowPickupModal(false)}
          isLoading={requestPickupMutation.isPending}
        />
      )}
    </div>
  );
}
