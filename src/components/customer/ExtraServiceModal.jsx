import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, PackagePlus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BottomSheetSelect from '@/components/ui/BottomSheetSelect';

// Self-service paid add-on request (bulky item, extra pickup, roll-off…).
// Shows the tenant's ServiceAddOn catalog with upfront prices and creates a
// PickupRequest carrying the quoted price for downstream billing.
export default function ExtraServiceModal({ customer, servicePoints = [], onClose }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState(null);
  const [address, setAddress] = useState(servicePoints?.[0]?.address || customer?.address || '');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');

  const { data: addOns = [], isLoading } = useQuery({
    queryKey: ['active-add-ons', customer?.tenant_id],
    queryFn: () => base44.entities.ServiceAddOn.filter({ active: true }),
    select: (rows) => rows
      .filter(a => a.customer_type === 'all' || !a.customer_type || a.customer_type === customer?.customer_type)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    enabled: !!customer,
  });

  const addressOptions = [
    ...(servicePoints || []).map(sp => ({ value: sp.address, label: sp.address })),
    ...(customer?.address ? [{ value: customer.address, label: 'My registered address' }] : []),
  ];

  const submit = useMutation({
    mutationFn: () => {
      // Carry the chosen service point's identifiers/coords so dispatch can
      // zone-filter the job and the route optimiser uses real coordinates.
      const sp = (servicePoints || []).find(p => p.address === address);
      return base44.entities.PickupRequest.create({
        customer_id: customer.id,
        tenant_id: customer.tenant_id,
        request_type: 'on_demand',
        status: 'pending',
        service_add_on_id: selected.id,
        service_category: selected.category,
        waste_type: selected.waste_type || 'bulky',
        quoted_price_ugx: selected.price_ugx || 0,
        billing_status: (selected.price_ugx || 0) > 0 ? 'quoted' : 'none',
        source: 'customer_app',
        address,
        ...(sp ? { service_point_id: sp.id, zone_id: sp.zone_id, latitude: sp.latitude, longitude: sp.longitude } : {}),
        scheduled_date: date || undefined,
        notes: notes || `${selected.name} requested via app`,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-pickups'] });
      onClose();
    },
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
              <PackagePlus className="w-5 h-5 text-primary" />
              <h3 className="font-semibold font-jakarta">Request Extra Service</h3>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
          </div>

          {isLoading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
          ) : addOns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No extra services are available right now.</p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                {addOns.map(a => (
                  <button
                    key={a.id}
                    onClick={() => setSelected(a)}
                    className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl border text-left transition-all ${
                      selected?.id === a.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium">{a.name}</p>
                      {a.description && <p className="text-xs text-muted-foreground">{a.description}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-primary">{(a.price_ugx || 0).toLocaleString()} UGX</p>
                      {selected?.id === a.id && <Check className="w-4 h-4 text-primary ml-auto mt-1" />}
                    </div>
                  </button>
                ))}
              </div>

              {selected && (
                <>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Pickup Address</label>
                    {addressOptions.length > 0 ? (
                      <BottomSheetSelect value={address} onChange={setAddress} options={addressOptions} placeholder="Select address…" />
                    ) : (
                      <input className="w-full border border-input bg-background rounded-lg px-3 py-2 text-sm" value={address} onChange={e => setAddress(e.target.value)} placeholder="Enter pickup address" />
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Preferred Date (optional)</label>
                    <input type="date" className="w-full border border-input bg-background rounded-lg px-3 py-2 text-sm" value={date} onChange={e => setDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Notes (optional)</label>
                    <textarea rows={2} className="w-full border border-input bg-background rounded-lg px-3 py-2 text-sm resize-none" value={notes} onChange={e => setNotes(e.target.value)} placeholder="What needs collecting?" />
                  </div>

                  <div className="rounded-xl bg-muted/60 px-4 py-3 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Estimated charge</span>
                    <span className="font-semibold text-primary">{(selected.price_ugx || 0).toLocaleString()} UGX</span>
                  </div>

                  <Button className="w-full" disabled={!address || submit.isPending} onClick={() => submit.mutate()}>
                    {submit.isPending ? 'Submitting…' : 'Confirm Request'}
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
