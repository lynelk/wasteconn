import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, ScanLine, Plus, Trash2, CheckCircle2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Deposit Return Scheme "scan to earn": the customer adds the barcodes of
// eligible recyclables and submits them for a wallet credit + loyalty points.
// Barcode entry is manual here; a device camera/scanner can populate the same
// field. Crediting is handled server-side by the scanDepositReturn function.
export default function ScanToEarnModal({ customer, onClose }) {
  const qc = useQueryClient();
  const [barcode, setBarcode] = useState('');
  const [items, setItems] = useState([]); // [{ barcode, quantity }]
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  // Stable per-redemption idempotency key so a retried submit credits once.
  const redemptionId = useRef(`drs-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

  const addItem = () => {
    const code = barcode.trim();
    if (!code) return;
    setItems(prev => {
      const existing = prev.find(i => i.barcode === code);
      if (existing) return prev.map(i => i.barcode === code ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { barcode: code, quantity: 1 }];
    });
    setBarcode('');
  };

  const removeItem = (code) => setItems(prev => prev.filter(i => i.barcode !== code));
  const totalItems = items.reduce((s, i) => s + i.quantity, 0);

  const submit = useMutation({
    mutationFn: () => base44.functions.invoke('scanDepositReturn', { customer_id: customer.id, items, redemption_id: redemptionId.current }),
    onSuccess: (res) => {
      const data = res?.data || res;
      if (data?.success) {
        setResult(data);
        qc.invalidateQueries({ queryKey: ['my-loyalty'] });
        qc.invalidateQueries({ queryKey: ['wallets'] });
      } else {
        setError(data?.message || 'None of the scanned items were recognised.');
      }
    },
    onError: (e) => setError(e.message || 'Could not process your items.'),
  });

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
              <ScanLine className="w-5 h-5 text-primary" />
              <h3 className="font-semibold font-jakarta">Scan to Earn</h3>
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
              {result.points_awarded > 0 && <p className="text-xs text-muted-foreground">+{result.points_awarded} loyalty points · {result.accepted} item(s) accepted{result.rejected ? `, ${result.rejected} not recognised` : ''}</p>}
              <Button className="w-full" onClick={onClose}>Done</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">Add the barcode of each eligible bottle or can. You'll be credited the deposit value to your wallet.</p>

              <div className="flex gap-2">
                <input
                  className="flex-1 border border-input bg-background rounded-lg px-3 py-2 text-sm"
                  value={barcode}
                  onChange={e => setBarcode(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addItem(); }}
                  placeholder="Enter / scan barcode"
                  inputMode="numeric"
                />
                <Button variant="outline" size="icon" onClick={addItem}><Plus className="w-4 h-4" /></Button>
              </div>

              {items.length > 0 && (
                <div className="space-y-2">
                  {items.map(i => (
                    <div key={i.barcode} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm">
                      <span className="font-mono text-xs">{i.barcode}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">×{i.quantity}</span>
                        <button onClick={() => removeItem(i.barcode)} className="text-muted-foreground hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}

              <Button className="w-full" disabled={totalItems === 0 || submit.isPending} onClick={() => { setError(''); submit.mutate(); }}>
                {submit.isPending ? 'Processing…' : `Redeem ${totalItems || ''} item${totalItems === 1 ? '' : 's'}`.trim()}
              </Button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
