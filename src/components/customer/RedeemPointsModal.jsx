import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, Gift, CheckCircle2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';

const UGX_PER_POINT = 10;
const MIN_REDEEM = 100;

// Redeem loyalty points for wallet credit. Tier is unaffected (lifetime points
// are preserved server-side); only the redeemable balance decreases.
export default function RedeemPointsModal({ customer, loyalty, onClose }) {
  const qc = useQueryClient();
  const available = loyalty?.points || 0;
  const [points, setPoints] = useState(Math.min(available, MIN_REDEEM));
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const reference = useRef(`redeem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

  const qty = Math.max(0, Math.floor(Number(points) || 0));
  const creditUgx = qty * UGX_PER_POINT;
  const invalid = qty < MIN_REDEEM || qty > available;

  const submit = useMutation({
    mutationFn: () => base44.functions.invoke('redeemLoyaltyPoints', {
      customer_id: customer.id,
      points: qty,
      reference: reference.current,
    }),
    onSuccess: (res) => {
      const data = res?.data || res;
      if (data?.success) {
        setResult(data);
        qc.invalidateQueries({ queryKey: ['my-loyalty'] });
        qc.invalidateQueries({ queryKey: ['wallets'] });
      } else {
        setError(data?.error || 'Could not redeem your points.');
      }
    },
    onError: (e) => setError(e.message || 'Could not redeem your points.'),
  });

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          initial={{ y: '100%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          className="relative bg-card w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl p-6"
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
              <div className="rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 px-4 py-3 flex items-center justify-center gap-2">
                <Wallet className="w-5 h-5 text-green-600" />
                <span className="text-lg font-bold font-jakarta text-green-700">+{(result.credited_ugx || 0).toLocaleString()} UGX</span>
              </div>
              <p className="text-xs text-muted-foreground">{(result.points_remaining ?? 0).toLocaleString()} points remaining</p>
              <Button className="w-full" onClick={onClose}>Done</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3 text-center">
                <p className="text-xs text-muted-foreground">Available to redeem</p>
                <p className="text-2xl font-bold font-jakarta text-primary">{available.toLocaleString()} pts</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">1 point = {UGX_PER_POINT} UGX · min {MIN_REDEEM} points</p>
              </div>

              {available < MIN_REDEEM ? (
                <p className="text-sm text-center text-muted-foreground py-2">You need at least {MIN_REDEEM} points to redeem.</p>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Points to redeem</label>
                    <input
                      type="number" min={MIN_REDEEM} max={available} step="10"
                      className="w-full border border-input bg-background rounded-lg px-3 py-2 text-sm"
                      value={points}
                      onChange={e => setPoints(e.target.value)}
                    />
                  </div>
                  <div className="rounded-xl bg-muted/60 px-4 py-3 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Wallet credit</span>
                    <span className="font-semibold text-primary">{creditUgx.toLocaleString()} UGX</span>
                  </div>
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <Button className="w-full" disabled={invalid || submit.isPending} onClick={() => { setError(''); submit.mutate(); }}>
                    {submit.isPending ? 'Redeeming…' : `Redeem ${qty || ''} points`.trim()}
                  </Button>
                </>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
