import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import PickupFeedback from './PickupFeedback';
import { MapPin, Calendar, Truck, Weight, User, Clock, FileText } from 'lucide-react';

const statusColor = {
  pending: 'bg-yellow-100 text-yellow-800',
  assigned: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

function DetailRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

export default function PickupDetailPanel({ pickup, onClose }) {
  const qc = useQueryClient();

  const { data: customer } = useQuery({
    queryKey: ['customer', pickup?.customer_id],
    queryFn: () => base44.entities.Customer.get(pickup.customer_id),
    enabled: !!pickup?.customer_id,
  });

  const { data: driver } = useQuery({
    queryKey: ['user', pickup?.assigned_driver_id],
    queryFn: () => base44.entities.User.get(pickup.assigned_driver_id),
    enabled: !!pickup?.assigned_driver_id,
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.PickupRequest.update(pickup.id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pickups'] }),
  });

  if (!pickup) return null;

  return (
    <Dialog open={!!pickup} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-jakarta flex items-center gap-2">
            Pickup Details
            <Badge className={`text-xs ${statusColor[pickup.status]}`} variant="secondary">
              {pickup.status?.replace('_', ' ')}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Core details */}
          <div className="grid grid-cols-2 gap-3">
            <DetailRow icon={User}     label="Customer"      value={customer?.full_name} />
            <DetailRow icon={MapPin}   label="Address"       value={pickup.address} />
            <DetailRow icon={Calendar} label="Scheduled"     value={pickup.scheduled_date ? format(new Date(pickup.scheduled_date), 'MMM d, yyyy') : null} />
            <DetailRow icon={Clock}    label="Completed"     value={pickup.completed_at ? format(new Date(pickup.completed_at), 'MMM d, yyyy HH:mm') : null} />
            <DetailRow icon={Truck}    label="Driver"        value={driver?.full_name || driver?.email} />
            <DetailRow icon={Weight}   label="Actual Weight" value={pickup.actual_weight_kg != null ? `${pickup.actual_weight_kg} kg` : null} />
            <DetailRow icon={FileText} label="Waste Type"    value={pickup.waste_type} />
            <DetailRow icon={Clock}    label="Duration"      value={pickup.actual_duration_mins != null ? `${pickup.actual_duration_mins} min` : null} />
          </div>

          {pickup.notes && (
            <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              <p className="text-xs font-medium text-foreground mb-1">Notes</p>
              {pickup.notes}
            </div>
          )}

          {/* Quick status actions */}
          {(pickup.status === 'pending' || pickup.status === 'assigned') && (
            <div className="flex gap-2">
              {pickup.status === 'pending' && (
                <Button size="sm" variant="outline" onClick={() => updateMutation.mutate({ status: 'assigned' })}>
                  Mark Assigned
                </Button>
              )}
              {pickup.status === 'assigned' && (
                <Button size="sm" onClick={() => updateMutation.mutate({ status: 'completed', completed_at: new Date().toISOString() })}>
                  Mark Completed
                </Button>
              )}
            </div>
          )}

          {/* Customer Satisfaction */}
          <PickupFeedback pickupId={pickup.id} />
        </div>
      </DialogContent>
    </Dialog>
  );
}