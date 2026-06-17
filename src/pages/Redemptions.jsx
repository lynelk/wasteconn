import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Ticket, CheckCircle2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import MobileSelect from '@/components/ui/MobileSelect';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';

const STATUS_BADGE = {
  issued: 'bg-yellow-100 text-yellow-700',
  claimed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-600',
};

export default function Redemptions() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: redemptions = [], isLoading } = useQuery({
    queryKey: ['reward-redemptions'],
    queryFn: () => base44.entities.RewardRedemption.list('-created_date', 500),
  });
  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: () => base44.entities.Customer.list() });
  const customerName = (id) => customers.find(c => c.id === id)?.full_name || '—';

  const claim = useMutation({
    mutationFn: (r) => base44.entities.RewardRedemption.update(r.id, {
      status: 'claimed',
      claimed_at: new Date().toISOString(),
      claimed_by: user?.email || user?.id,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reward-redemptions'] }); toast({ title: 'Marked claimed' }); },
    onError: (e) => toast({ title: 'Could not update', description: e.message, variant: 'destructive' }),
  });

  const cancel = useMutation({
    mutationFn: (r) => base44.entities.RewardRedemption.update(r.id, { status: 'cancelled' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reward-redemptions'] }); toast({ title: 'Redemption cancelled' }); },
  });

  const filtered = statusFilter === 'all' ? redemptions : redemptions.filter(r => r.status === statusFilter);
  const issuedCount = redemptions.filter(r => r.status === 'issued').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-jakarta flex items-center gap-2">
            <Ticket className="w-6 h-6 text-primary" /> Reward Redemptions
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Track loyalty redemptions · claim issued vouchers at point of service</p>
        </div>
        <div className="w-44">
          <MobileSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'all', label: `All (${redemptions.length})` },
              { value: 'issued', label: `Issued (${issuedCount})` },
              { value: 'claimed', label: 'Claimed' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Ticket className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No redemptions {statusFilter !== 'all' ? `with status "${statusFilter}"` : 'yet'}.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map(r => (
            <Card key={r.id} className="border-border/60">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold font-jakarta">{r.reward_name || 'Reward'}</p>
                      <Badge variant="secondary" className={`text-[10px] ${STATUS_BADGE[r.status] || ''}`}>{r.status}</Badge>
                      {r.reward_type === 'wallet_credit' && <Badge variant="outline" className="text-[10px] gap-1"><Wallet className="w-3 h-3" /> credit</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{customerName(r.customer_id)} · {(r.cost_points || 0).toLocaleString()} pts</p>
                    {r.voucher_code && <p className="text-sm font-mono font-semibold text-primary mt-1">{r.voucher_code}</p>}
                    {r.value_ugx > 0 && <p className="text-xs text-muted-foreground">{(r.value_ugx).toLocaleString()} UGX</p>}
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {r.created_date ? format(new Date(r.created_date), 'dd MMM yyyy') : ''}
                      {r.claimed_at ? ` · claimed ${format(new Date(r.claimed_at), 'dd MMM')}` : ''}
                    </p>
                  </div>
                  {r.status === 'issued' && (
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <Button size="sm" className="gap-1.5" disabled={claim.isPending} onClick={() => claim.mutate(r)}>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Claim
                      </Button>
                      <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={() => cancel.mutate(r)}>Cancel</Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
