/**
 * IncidentReportModal — lets field agents log an incident directly to the Omni-Inbox (Ticket entity).
 * Works offline — queues to IndexedDB and syncs when back online.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, Camera, MapPin, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import MobileSelect from '@/components/ui/MobileSelect';
import { base44 } from '@/api/base44Client';
import { enqueueAction } from '@/lib/offlineDB';

const CATEGORIES = [
  { value: 'missed_collection', label: 'Missed Collection' },
  { value: 'access_issue', label: 'Access Issue' },
  { value: 'bin_damage', label: 'Bin Damage' },
  { value: 'vehicle_breakdown', label: 'Vehicle Breakdown' },
  { value: 'driver_behaviour', label: 'Driver Behaviour' },
  { value: 'other', label: 'Other' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export default function IncidentReportModal({ open, onClose, pickupId, user, isOnline }) {
  const [form, setForm] = useState({ category: 'other', priority: 'medium', subject: '', description: '', photo_url: '' });
  const [gps, setGps] = useState(null);
  const [captureGPS, setCaptureGPS] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleGPS = () => {
    setCaptureGPS(true);
    navigator.geolocation?.getCurrentPosition(
      pos => { setGps({ lat: pos.coords.latitude, lon: pos.coords.longitude }); setCaptureGPS(false); },
      () => setCaptureGPS(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (isOnline) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set('photo_url', file_url);
    } else {
      // Store as dataURL offline
      const reader = new FileReader();
      reader.onload = () => set('photo_url', reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!form.description) return;
    setSubmitting(true);
    const payload = {
      category: form.category,
      priority: form.priority,
      subject: form.subject || `Field incident: ${form.category}`,
      description: form.description,
      source: 'in_app',
      status: 'open',
      customer_name: user?.full_name,
      ...(gps ? { zone_id: null } : {}),
      ...(form.photo_url && !form.photo_url.startsWith('data:') ? { notes: `Photo: ${form.photo_url}` } : {}),
      ...(pickupId ? { notes: `Linked to pickup: ${pickupId}` } : {}),
    };

    if (isOnline) {
      await base44.entities.Ticket.create(payload);
    } else {
      await enqueueAction('Ticket', 'create', payload);
    }
    setSubmitting(false);
    setDone(true);
    setTimeout(() => { setDone(false); onClose(); }, 1500);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900 rounded-t-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
            style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-700 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-semibold font-jakarta">Log Incident Report</span>
              </div>
              <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {done ? (
              <div className="flex flex-col items-center py-12 gap-3">
                <CheckCircle2 className="w-12 h-12 text-green-400" />
                <p className="text-white font-medium">{isOnline ? 'Incident reported to Omni-Inbox' : 'Saved offline — will sync when online'}</p>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-gray-300 text-xs">Category</Label>
                  <MobileSelect value={form.category} onChange={v => set('category', v)} options={CATEGORIES} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-gray-300 text-xs">Priority</Label>
                  <MobileSelect value={form.priority} onChange={v => set('priority', v)} options={PRIORITIES} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-gray-300 text-xs">Subject</Label>
                  <Input value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="Brief title…" className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-gray-300 text-xs">Description *</Label>
                  <Textarea rows={3} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe the incident…" className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500" />
                </div>

                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" className="flex-1 gap-2 border-gray-700 text-gray-300"
                    onClick={() => document.getElementById('incident-photo-input').click()}>
                    <Camera className="w-4 h-4" /> {form.photo_url ? 'Photo ✓' : 'Add Photo'}
                  </Button>
                  <input id="incident-photo-input" type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
                  <Button type="button" variant="outline" size="sm" className="flex-1 gap-2 border-gray-700 text-gray-300" onClick={handleGPS} disabled={captureGPS}>
                    {captureGPS ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                    {gps ? `${gps.lat.toFixed(4)}, ${gps.lon.toFixed(4)}` : 'Add GPS'}
                  </Button>
                </div>

                {!isOnline && (
                  <p className="text-xs text-yellow-400 bg-yellow-900/30 px-3 py-2 rounded-lg">
                    Offline — report will sync to Omni-Inbox when connectivity is restored.
                  </p>
                )}

                <Button onClick={handleSubmit} disabled={submitting || !form.description} className="w-full gap-2">
                  {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : 'Submit Incident Report'}
                </Button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}