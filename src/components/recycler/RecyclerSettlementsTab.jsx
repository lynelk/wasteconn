import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function RecyclerSettlementsTab() {
  const [settling, setSettling] = useState(null);
  const qc = useQueryClient();

  const { data: offers = [] } = useQuery({
    queryKey: ['recycler-offers'],
    queryFn: () => base44.entities.RecyclerOffer.list('-created_date', 200),
  });

  const { data: buyers = [] } = useQuery({
    queryKey: ['recycler-buyers'],
    queryFn: () => base44.entities.RecyclerBuyer.list(),
  });

  const { data: listings = [] } = useQuery({
    queryKey: ['material-listings'],
    queryFn: () => base44.entities.MaterialListing.list(),
  });

  const buyerMap = Object.fromEntries(buyers.map(b => [b.id, b]));
  const listingMap = Object.fromEntries(listings.map(l => [l.id, l]));

  const accepted = offers.filter(o => o.status === 'accepted');
  const completed = offers.filter(o => o.status === 'completed');

  const totalSettled = completed.reduce((s, o) => s + (o.settlement_ugx || 0), 0);

  const handleSettle = async (offer_id) => {
    setSettling(offer_id);
    try {
      const res = await base44.functions.invoke('settleRecyclerTransaction', { offer_id });
      toast.success(`Transaction settled: UGX ${(res.data?.settlement_ugx || 0).toLocaleString()}`);
      qc.invalidateQueries({ queryKey: ['recycler-offers'] });
      qc.invalidateQueries({ queryKey: ['material-listings'] });
    } catch (e) {
      toast.error(e.message || 'Settlement failed');
    }
    setSettling(null);
  };

  return (
    <div className="space-y-6">
      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Ready to Settle</p>
            <p className="text-2xl font-bold text-foreground">{accepted.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Completed</p>
            <p className="text-2xl font-bold text-foreground">{completed.length}</p>
          </CardContent>
        </Card>
        <Card className="col-span-2 md:col-span-1">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Settled</p>
            <p className="text-lg font-bold text-primary">UGX {totalSettled.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Accepted — ready for settlement */}
      {accepted.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Ready to Settle ({accepted.length})</h3>
          <div className="space-y-2">
            {accepted.map(o => {
              const total = (o.offered_price_per_kg_ugx || 0) * (o.quantity_kg || 0);
              return (
                <Card key={o.id}>
                  <CardContent className="p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{buyerMap[o.buyer_id]?.company_name || 'Buyer'}</p>
                      <p className="text-xs text-muted-foreground">
                        {listingMap[o.listing_id]?.material} · {o.quantity_kg}kg · UGX {total.toLocaleString()}
                      </p>
                    </div>
                    <Button size="sm" className="h-8" onClick={() => handleSettle(o.id)} disabled={settling === o.id}>
                      {settling === o.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5 mr-1" />}
                      Settle
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Completed */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Completed Transactions ({completed.length})</h3>
        {completed.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No settled transactions yet.</p>
        ) : (
          <div className="space-y-1.5">
            {completed.map(o => (
              <div key={o.id} className="flex items-center justify-between text-xs p-2.5 rounded bg-muted/40">
                <div>
                  <span className="font-medium">{buyerMap[o.buyer_id]?.company_name || 'Buyer'}</span>
                  <span className="text-muted-foreground"> · {listingMap[o.listing_id]?.material} · {o.quantity_kg}kg</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">UGX {(o.settlement_ugx || 0).toLocaleString()}</span>
                  <Badge className="bg-blue-100 text-blue-700">Completed</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}