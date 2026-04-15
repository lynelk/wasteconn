import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BottomSheetSelect from '@/components/ui/BottomSheetSelect';

export default function CustomerPickupModal({ servicePoints, customer, onSubmit, onClose, isLoading }) {
  const [form, setForm] = useState({
    waste_type: 'general',
    address: servicePoints?.[0]?.address || customer?.address || '',
    notes: '',
    scheduled_date: '',
  });

  const wasteTypes = ['general', 'recyclable', 'organic', 'hazardous', 'bulky'];

  const addressOptions = [
    ...(servicePoints || []).map(sp => ({ value: sp.address, label: sp.address })),
    ...(customer?.address ? [{ value: customer.address, label: 'My registered address' }] : []),
  ];

  return (
    <AnimatePresence>
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        className="relative bg-card w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl p-6"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            <h3 className="font-semibold font-jakarta">Request Extra Pickup</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Waste Type</label>
            <div className="flex flex-wrap gap-2">
              {wasteTypes.map(wt => (
                <button
                  key={wt}
                  onClick={() => setForm(f => ({ ...f, waste_type: wt }))}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all capitalize ${
                    form.waste_type === wt
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  {wt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Pickup Address</label>
            {addressOptions.length > 0 ? (
              <BottomSheetSelect
                value={form.address}
                onChange={val => setForm(f => ({ ...f, address: val }))}
                options={addressOptions}
                placeholder="Select address…"
              />
            ) : (
              <input
                className="w-full border border-input bg-background rounded-lg px-3 py-2 text-sm"
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder="Enter pickup address"
              />
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Preferred Date (optional)</label>
            <input
              type="date"
              className="w-full border border-input bg-background rounded-lg px-3 py-2 text-sm"
              value={form.scheduled_date}
              onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Additional Notes</label>
            <textarea
              className="w-full border border-input bg-background rounded-lg px-3 py-2 text-sm resize-none"
              rows={3}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Any special instructions..."
            />
          </div>

          <Button
            className="w-full"
            onClick={() => onSubmit(form)}
            disabled={isLoading || !form.address}
          >
            {isLoading ? 'Submitting...' : 'Submit Pickup Request'}
          </Button>
        </div>
      </motion.div>
    </div>
    </AnimatePresence>
  );
}