import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, Gift, CheckCircle2, Wallet, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DEFAULT_MIN_REDEEM = 100;

function newReference() {
  return `redeem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// Redeem loyalty points — against the rewards catalog or as ad-hoc wallet
// credit. Tier is unaffected (lifetime points are preserved server-side); only
// the redeemable balance decreases.
export default function RedeemPointsModal({ customer, loyalty, onClose }) {
  const qc = useQueryClient();
  const available = loyalty?.points || 0;
  const [points, setPoints] = useState(Math.min(available, DEFAULT_MIN_REDEEM));
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const { data: rewards = [] } = useQuery({
    queryKey: ['active-loyalty-rewards', customer?.tenant_id],
    queryFn: () => base44.entities.LoyaltyReward.filter({ active: true }),
    select: (rows) => rows.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    enabled: !!customer,
  });

  const redeem = useMutation({
    mutationFn: (payload) => base44.functions.invoke('redeemLoyaltyPoints', {
      customer_id: customer.id,
      ...payload,
    }),
    onSuccess: (res) => {
      const data = res?.data || res;
      if (data?.success) {
        setResult(data);
        qc.invalidateQueries({ queryKey: ['my-loyalty'] });
        qc.invalidateQueries({ queryKey: ['wallets'] });
        qc.invalidateQueries({ queryKey: ['active-loyalty-rewards'] });
      } else {
        setError(data?.error || 'Could not redeem.');
      }
    },
    onError: (e) => setError(e.message || 'Could not redeem.'),
  });

  const qty = Math.max(0, Math.floor(Number(points) || 0));
  const adHocInvalid = qty < DEFAULT_MIN_REDEEM || qty > available;
  const inStock = (r) => typeof r.stock !== 'number' || r.stock > 0;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          initial={{ y: '100%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          className="relative bg-card w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto"
          style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-primary" />
              <h3 className="font-semibold font-jakarta">Redeem Points</h3>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
          </div>

          {result ? (
            <div className="text-center space-y-3 py-4">
              <CheckCircle2 className="w-12 h-12 mx-auto text-green-500" />
              <p className="text-sm text-muted-foreground">{result.message}</p>
              {result.credited_ugx > 0 && (
                <div className="rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 px-4 py-3 flex items-center justify-center gap-2">
                  <Wallet className="w-5 h-5 text-green-600" />
                  <span className="text-lg font-bold font-jakarta text-green-700">+{(result.credited_ugx || 0).toLocaleString()} UGX</span>
                </div>
              )}
              {result.voucher_code && (
                <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3 flex items-center justify-center gap-2">
                  <Ticket className="w-5 h-5 text-primary" />
                  <span className="text-lg font-bold font-jakarta text-primary tracking-wider">{result.voucher_code}</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground">{(result.points_remaining ?? 0).toLocaleString()} points remaining</p>
              <Button className="w-full" onClick={onClose}>Done</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3 text-center">
                <p className="text-xs text-muted-foreground">Available to redeem</p>
                <p className="text-2xl font-bold font-jakarta text-primary">{available.toLocaleString()} pts</p>
              </div>

              {/* Rewards catalog */}
              {rewards.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rewards</p>
                  {rewards.map((r) => {
                    const affordable = available >= (r.cost_points || 0) && inStock(r);
                    return (
                      <div key={r.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border">
                        <div>
                          <p className="text-sm font-medium">{r.name}</p>
                          {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                          <p className="text-xs text-primary font-medium mt-0.5">
                            {(r.cost_points || 0).toLocaleString()} pts
                            {r.reward_type === 'wallet_credit' && ` → ${(r.value_ugx || 0).toLocaleString()} UGX`}
                            {typeof r.stock === 'number' && r.stock <= 0 && ' · out of stock'}
                          </p>
                        </div>
                        <Button size="sm" variant="outline" disabled={!affordable || redeem.isPending} onClick={() => { setError(''); redeem.mutate({ reward_id: r.id, reference: newReference() }); }}>
                          Redeem
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Ad-hoc wallet credit */}
              {available >= DEFAULT_MIN_REDEEM && (
                <div className="space-y-3 border-t border-border pt-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Or convert to wallet credit</p>
                  <input
                    type="number" min={DEFAULT_MIN_REDEEM} max={available} step="10"
                    className="w-full border border-input bg-background rounded-lg px-3 py-2 text-sm"
                    value={points}
                    onChange={e => setPoints(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">Min {DEFAULT_MIN_REDEEM} points · rate set by your provider.</p>
                  <Button className="w-full" disabled={adHocInvalid || redeem.isPending} onClick={() => { setError(''); redeem.mutate({ points: qty, reference: newReference() }); }}>
                    {redeem.isPending ? 'Redeeming…' : `Convert ${qty || ''} points`.trim()}
                  </Button>
                </div>
              )}

              {rewards.length === 0 && available < DEFAULT_MIN_REDEEM && (
                <p className="text-sm text-center text-muted-foreground py-2">You need at least {DEFAULT_MIN_REDEEM} points to redeem.</p>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
