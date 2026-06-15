import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { MapPin, Navigation, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LocationCorrectionModal({ job, onClose }) {
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const captureGPS = () => {
    navigator.geolocation?.getCurrentPosition(
      pos => { setLat(pos.coords.latitude.toFixed(6)); setLng(pos.coords.longitude.toFixed(6)); },
      () => {},
      { enableHighAccuracy: true }
    );
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    // Find linked service point if any, else note on the pickup request
    const notes = `[LOCATION CORRECTION REQUEST] Driver GPS: ${lat},${lng}. Reason: ${reason}. Original address: ${job.address}`;
    await base44.entities.PickupRequest.update(job.id, { driver_notes: notes });

    // Try to update service point if linked
    if (job.service_point_id) {
      const sps = await base44.entities.ServicePoint.filter({ id: job.service_point_id });
      const sp = sps?.[0];
      if (sp) {
        const now = new Date().toISOString();
        const existingHistory = sp.change_history || [];
        await base44.entities.ServicePoint.update(sp.id, {
          pending_change: {
            requested_by: 'driver',
            requested_at: now,
            new_latitude: parseFloat(lat),
            new_longitude: parseFloat(lng),
            new_address: sp.address,
            reason,
          },
          change_history: [...existingHistory, {
            changed_at: now,
            changed_by: 'driver_suggestion',
            field: 'coordinates',
            old_value: `${sp.latitude},${sp.longitude}`,
            new_value: `${lat},${lng}`,
            reason,
          }],
        });
      }
    }
    setSubmitting(false);
    setDone(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60">
      <div className="bg-gray-900 rounded-t-2xl w-full max-w-md p-5 border-t border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-orange-400" />
            <p className="font-semibold text-sm text-white">Suggest Location Correction</p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>

        {done ? (
          <div className="text-center py-4">
            <div className="w-10 h-10 rounded-full bg-green-900/50 flex items-center justify-center mx-auto mb-3">
              <Send className="w-5 h-5 text-green-400" />
            </div>
            <p className="text-sm text-green-400 font-medium">Correction submitted</p>
            <p className="text-xs text-gray-400 mt-1">Dispatcher will review and update the pin</p>
            <Button onClick={onClose} size="sm" className="mt-4 w-full" variant="outline">Close</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-xl p-3 text-xs text-gray-300">
              <p className="text-gray-500 mb-0.5">Current address</p>
              <p>{job.address}</p>
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <p className="text-xs text-gray-500 mb-1">Latitude</p>
                <input
                  type="number" step="any" value={lat} onChange={e => setLat(e.target.value)}
                  placeholder="0.316300"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600"
                />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500 mb-1">Longitude</p>
                <input
                  type="number" step="any" value={lng} onChange={e => setLng(e.target.value)}
                  placeholder="32.581100"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600"
                />
              </div>
            </div>

            <button
              onClick={captureGPS}
              className="w-full flex items-center justify-center gap-2 text-xs text-blue-400 bg-blue-950/50 border border-blue-800 px-3 py-2.5 rounded-lg"
            >
              <Navigation className="w-3.5 h-3.5" /> Capture My GPS Location
            </button>

            <div>
              <p className="text-xs text-gray-500 mb-1">Reason</p>
              <textarea
                value={reason} onChange={e => setReason(e.target.value)}
                rows={2}
                placeholder="e.g. Pin is 50m off. Actual bin is behind the school gate."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 resize-none"
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitting || !reason}
              className="w-full gap-2"
            >
              {submitting ? 'Submitting...' : <><Send className="w-3.5 h-3.5" /> Submit Correction</>}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}