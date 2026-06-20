import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  completed: 'bg-blue-100 text-blue-700',
};

export default function OffersQueue() {
  const [acting, setActing] = useState(null);
  const qc = useQueryClient();

  const { data: offers = [], isLoading } = useQuery({
    queryKey: ['recycler-offers'],
    queryFn: () => base44.entities.RecyclerOffer.list('-created_date', 100),
  });

  const { data: listings = [] } = useQuery({
    queryKey: ['material-listings'],
    queryFn: () => base44.entities.MaterialListing.list(),
  });

  const { data: buyers = [] } = useQuery({
    queryKey: ['recycler-buyers'],
    queryFn: () => base44.entities.RecyclerBuyer.list(),
  });

  const listingMap = Object.fromEntries(listings.map(l => [l.id, l]));
  const buyerMap = Object.fromEntries(buyers.map(b => [b.id, b]));

  const handleAction = async (offer_id, action) => {
    setActing(offer_id);
    try {
      await base44.functions.invoke('respondToOffer', { offer_id, action });
      toast.success(`Offer ${action}ed successfully`);
      qc.invalidateQueries({ queryKey: ['recycler-offers'] });
      qc.invalidateQueries({ queryKey: ['material-listings'] });
    } catch (e) {
      toast.error(e.message || 'Action failed');
    }
    setActing(null);
  };

  const pending = offers.filter(o => o.status === 'pending');
  const others = offers.filter(o => o.status !== 'pending');

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-2">Pending Offers ({pending.length})</h3>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Loading…</div>
        ) : pending.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No pending offers.</p>
        ) : (
          <div className="space-y-3">
            {pending.map(o => {
              const listing = listingMap[o.listing_id];
              const buyer = buyerMap[o.buyer_id];
              const total = (o.offered_price_per_kg_ugx || 0) * (o.quantity_kg || 0);
              return (
                <Card key={o.id}>
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-medium text-sm">{buyer?.company_name || 'Unknown Buyer'}</p>
                        <p className="text-xs text-muted-foreground">
                          {listing ? `${listing.material} · Grade ${listing.grade} · ${listing.quantity_kg}kg` : 'Listing'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Offering UGX {(o.offered_price_per_kg_ugx || 0).toLocaleString()}/kg × {o.quantity_kg}kg
                          = <span className="font-semibold text-foreground">UGX {total.toLocaleString()}</span>
                        </p>
                        {o.pickup_date && <p className="text-xs text-muted-foreground">Pickup: {new Date(o.pickup_date).toLocaleDateString()}</p>}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50 h-8"
                          onClick={() => handleAction(o.id, 'reject')}
                          disabled={acting === o.id}
                        >
                          {acting === o.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                          Reject
                        </Button>
                        <Button size="sm"
                          className="h-8"
                          onClick={() => handleAction(o.id, 'accept')}
                          disabled={acting === o.id}
                        >
                          {acting === o.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                          Accept
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {others.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Recent Activity</h3>
          <div className="space-y-1.5">
            {others.map(o => (
              <div key={o.id} className="flex items-center justify-between text-xs p-2 rounded bg-muted/40">
                <span>{buyerMap[o.buyer_id]?.company_name || 'Buyer'} · {listingMap[o.listing_id]?.material || 'Listing'}</span>
                <Badge className={`text-xs ${STATUS_COLORS[o.status]}`}>{o.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}