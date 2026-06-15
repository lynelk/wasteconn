import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, PackagePlus, Check, Camera, Loader2 } from 'lucide-react';
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
  const [photoUrls, setPhotoUrls] = useState([]);
  const [uploading, setUploading] = useState(false);

  const uploadPhotos = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = [];
      for (const file of files.slice(0, 4 - photoUrls.length)) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        if (file_url) urls.push(file_url);
      }
      setPhotoUrls(prev => [...prev, ...urls]);
    } catch (_) { /* surfaced by disabled submit */ } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const photoRequired = !!selected?.requires_photo;
  const photoMissing = photoRequired && photoUrls.length === 0;

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
        ...(photoUrls.length ? { photo_urls: photoUrls } : {}),
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

                  {photoRequired && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Photo {photoMissing && <span className="text-red-500">*</span>}</label>
                      <div className="flex flex-wrap gap-2">
                        {photoUrls.map((url) => (
                          <img key={url} src={url} alt="Attached" className="w-16 h-16 rounded-lg object-cover border border-border" />
                        ))}
                        {photoUrls.length < 4 && (
                          <label className="w-16 h-16 rounded-lg border border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/50">
                            {uploading ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : <Camera className="w-5 h-5 text-muted-foreground" />}
                            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={uploadPhotos} disabled={uploading} />
                          </label>
                        )}
                      </div>
                      {photoMissing && <p className="text-xs text-muted-foreground mt-1">A photo is required for this service.</p>}
                    </div>
                  )}

                  <div className="rounded-xl bg-muted/60 px-4 py-3 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Estimated charge</span>
                    <span className="font-semibold text-primary">{(selected.price_ugx || 0).toLocaleString()} UGX</span>
                  </div>

                  <Button className="w-full" disabled={!address || submit.isPending || uploading || photoMissing} onClick={() => submit.mutate()}>
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
