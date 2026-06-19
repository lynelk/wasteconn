import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, CheckCircle, Camera, X, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';

function haversineMetres(lat1, lng1, lat2, lng2) {
  if (!lat1 || !lng1 || !lat2 || !lng2) return null;
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function DistributionModal({ job, activeUser, onClose, onSaved }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState('select'); // select | confirm
  const [selectedItem, setSelectedItem] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [gps, setGps] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}
      );
    }
  }, []);

  const { data: inventoryItems = [] } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => base44.entities.Inventory.list(),
  });

  const { data: customer } = useQuery({
    queryKey: ['customer', job?.customer_id],
    queryFn: () => base44.entities.Customer.filter({ id: job?.customer_id }).then(r => r[0]),
    enabled: !!job?.customer_id,
  });

  const handlePhotoCapture = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setPhotoUrl(file_url);
    setUploading(false);
  };

  const handleSubmit = async () => {
    if (!selectedItem || quantity < 1) return;
    setSaving(true);

    const gpsDistM = gps && customer?.latitude && customer?.longitude
      ? haversineMetres(gps.lat, gps.lng, customer.latitude, customer.longitude)
      : null;

    const record = {
      tenant_id: job?.tenant_id || activeUser?.tenant_id || 'default',
      inventory_item_id: selectedItem.id,
      item_name_snapshot: selectedItem.item_name,
      item_category_snapshot: selectedItem.category,
      unit_cost_snapshot_ugx: selectedItem.unit_cost_ugx || 0,
      quantity,
      total_value_ugx: (selectedItem.unit_cost_ugx || 0) * quantity,
      customer_id: job?.customer_id || '',
      customer_name_snapshot: customer?.full_name || '',
      customer_address_snapshot: customer?.address || job?.address || '',
      zone_id: job?.zone_id || '',
      pickup_request_id: job?.id || '',
      distributed_by_user_id: activeUser?.id || '',
      distributed_by_name_snapshot: activeUser?.full_name || '',
      distribution_date: new Date().toISOString(),
      gps_lat: gps?.lat || null,
      gps_lng: gps?.lng || null,
      customer_lat: customer?.latitude || null,
      customer_lng: customer?.longitude || null,
      gps_distance_m: gpsDistM ? Math.round(gpsDistM) : null,
      gps_radius_breach: gpsDistM !== null && gpsDistM > 500,
      proof_photo_url: photoUrl || null,
      status: confirmed ? 'confirmed' : 'pending',
      customer_confirmation_timestamp: confirmed ? new Date().toISOString() : null,
      confirmed_by: confirmed ? activeUser?.id : null,
    };

    await base44.entities.ItemDistribution.create(record);

    // Decrement inventory stock
    const newStock = Math.max(0, (selectedItem.current_stock || 0) - quantity);
    await base44.entities.Inventory.update(selectedItem.id, { current_stock: newStock });

    queryClient.invalidateQueries({ queryKey: ['inventory'] });
    queryClient.invalidateQueries({ queryKey: ['item-distributions'] });
    setSaving(false);
    onSaved && onSaved();
    onClose();
  };

  const availableItems = inventoryItems.filter(i => i.current_stock > 0);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center">
      <div className="bg-gray-900 w-full max-w-md rounded-t-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-white text-base">Give Out Items</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Customer info */}
        {customer && (
          <div className="bg-gray-800 rounded-xl px-4 py-3 flex items-start gap-3">
            <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-white font-medium text-sm">{customer.full_name}</p>
              <p className="text-gray-400 text-xs">{customer.address || 'No address recorded'}</p>
            </div>
          </div>
        )}

        {/* GPS status */}
        {gps ? (
          <div className="text-xs text-green-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
            GPS captured ({gps.lat.toFixed(5)}, {gps.lng.toFixed(5)})
          </div>
        ) : (
          <div className="text-xs text-yellow-400">⚠️ GPS not available — distribution will be flagged</div>
        )}

        {/* Step 1: Select item */}
        <div>
          <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-2">Select Item</p>
          <div className="space-y-2">
            {availableItems.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-4">No items in stock</p>
            )}
            {availableItems.map(item => (
              <button
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                  selectedItem?.id === item.id
                    ? 'border-primary bg-primary/10 text-white'
                    : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{item.item_name}</p>
                    <p className="text-xs text-gray-400">{item.category?.replace(/_/g, ' ')} · {item.unit_cost_ugx ? `UGX ${item.unit_cost_ugx.toLocaleString()}` : 'No cost set'}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${item.current_stock <= item.safety_threshold ? 'bg-red-900 text-red-300' : 'bg-green-900 text-green-300'}`}>
                    {item.current_stock} {item.unit_of_measure}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Quantity */}
        {selectedItem && (
          <div>
            <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-2">Quantity</p>
            <div className="flex items-center gap-3 bg-gray-800 rounded-xl px-4 py-3">
              <button
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="w-8 h-8 bg-gray-700 text-white rounded-full flex items-center justify-center text-lg font-bold"
              >−</button>
              <span className="flex-1 text-center text-white font-bold text-xl">{quantity}</span>
              <button
                onClick={() => setQuantity(q => Math.min(selectedItem.current_stock, q + 1))}
                className="w-8 h-8 bg-gray-700 text-white rounded-full flex items-center justify-center text-lg font-bold"
              >+</button>
            </div>
            <p className="text-xs text-gray-500 mt-1 text-right">
              Total value: UGX {((selectedItem.unit_cost_ugx || 0) * quantity).toLocaleString()}
            </p>
          </div>
        )}

        {/* Photo proof */}
        <div>
          <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-2">Proof of Handover (Optional)</p>
          {photoUrl ? (
            <div className="relative">
              <img src={photoUrl} alt="Proof" className="w-full h-32 object-cover rounded-xl" />
              <button
                onClick={() => setPhotoUrl(null)}
                className="absolute top-2 right-2 bg-black/60 rounded-full p-1"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-700 rounded-xl py-5 cursor-pointer hover:border-gray-500 transition-colors">
              <Camera className="w-6 h-6 text-gray-500" />
              <span className="text-xs text-gray-500">{uploading ? 'Uploading...' : 'Tap to take photo'}</span>
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoCapture} />
            </label>
          )}
        </div>

        {/* Customer confirmation toggle */}
        <label className="flex items-center gap-3 bg-gray-800 rounded-xl px-4 py-3 cursor-pointer">
          <div
            onClick={() => setConfirmed(c => !c)}
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${confirmed ? 'bg-primary border-primary' : 'border-gray-500'}`}
          >
            {confirmed && <CheckCircle className="w-3 h-3 text-white" />}
          </div>
          <div>
            <p className="text-white text-sm font-medium">Customer confirmed receipt</p>
            <p className="text-gray-400 text-xs">Tap if the customer has acknowledged receiving the items</p>
          </div>
        </label>

        {/* Submit */}
        <Button
          className="w-full"
          disabled={!selectedItem || saving}
          onClick={handleSubmit}
        >
          {saving ? 'Recording...' : `Record Distribution of ${quantity} ${selectedItem?.item_name || 'items'}`}
        </Button>
      </div>
    </div>
  );
}