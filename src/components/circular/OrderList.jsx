import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Truck, CheckCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const deliveryColors = {
  pending: 'bg-yellow-100 text-yellow-700',
  scheduled: 'bg-blue-100 text-blue-700',
  in_transit: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-600',
};

const paymentColors = {
  pending: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  refunded: 'bg-gray-100 text-gray-600',
};

export default function OrderList({ orders }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.CustomerOrder.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer-orders'] }),
  });

  const handleUpdateStatus = (order, status) => {
    updateMutation.mutate({
      id: order.id,
      data: { delivery_status: status, ...(status === 'delivered' ? { delivered_at: new Date().toISOString() } : {}) }
    });
    toast({ title: `Order marked as ${status}` });
  };

  if (orders.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p>No orders yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map(order => (
        <Card key={order.id} className="border-border/60">
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-semibold text-sm font-jakarta">{order.order_number || `ORD-${order.id.slice(0,6)}`}</span>
                  <Badge className={`text-xs ${deliveryColors[order.delivery_status] || ''}`} variant="secondary">
                    {order.delivery_status?.replace('_', ' ')}
                  </Badge>
                  <Badge className={`text-xs ${paymentColors[order.payment_status] || ''}`} variant="secondary">
                    {order.payment_status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{order.delivery_address}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Requested: {order.requested_delivery_date} {order.requested_delivery_slot && `· ${order.requested_delivery_slot}`}
                  {order.confirmed_delivery_date && ` · Confirmed: ${order.confirmed_delivery_date} ${order.confirmed_delivery_slot || ''}`}
                </p>
                <p className="text-sm font-bold text-primary mt-1">{(order.total_amount_ugx || 0).toLocaleString()} UGX</p>
                {order.items?.length > 0 && (
                  <div className="flex gap-1 flex-wrap mt-1">
                    {order.items.map((item, i) => (
                      <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded">{item.product_name || 'Item'} × {item.quantity}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1 ml-3">
                {order.delivery_status === 'pending' && (
                  <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(order, 'scheduled')} className="text-xs h-7 gap-1">
                    <Truck className="w-3 h-3" /> Schedule
                  </Button>
                )}
                {order.delivery_status === 'scheduled' && (
                  <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(order, 'in_transit')} className="text-xs h-7 gap-1">
                    <Truck className="w-3 h-3" /> In Transit
                  </Button>
                )}
                {order.delivery_status === 'in_transit' && (
                  <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(order, 'delivered')} className="text-xs h-7 gap-1 text-green-700">
                    <CheckCircle className="w-3 h-3" /> Delivered
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}