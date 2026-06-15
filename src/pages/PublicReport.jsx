import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, MapPin, CheckCircle2, Trash2, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CATEGORIES = [
  { value: 'illegal_dumping', label: 'Illegal dumping', icon: Trash2 },
  { value: 'overflowing_bin', label: 'Overflowing bin', icon: AlertTriangle },
  { value: 'damaged_bin', label: 'Damaged bin', icon: AlertTriangle },
  { value: 'missed_collection', label: 'Missed collection', icon: Trash2 },
  { value: 'other', label: 'Something else', icon: AlertTriangle },
];

export default function PublicReport() {
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const tenantId = params.get('tenant') || params.get('t') || '';

  const [category, setCategory] = useState('illegal_dumping');
  const [description, setDescription] = useState('');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [binCode, setBinCode] = useState('');
  const [coords, setCoords] = useState(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const captureLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }); setLocating(false); },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const submit = async () => {
    setError('');
    if (description.trim().length < 5) { setError('Please describe the issue (at least a few words).'); return; }
    setSubmitting(true);
    try {
      const payload = {
        category,
        description: description.trim(),
        reporter_name: name.trim(),
        reporter_contact: contact.trim(),
        smart_bin_code: binCode.trim() || undefined,
        ...(tenantId ? { tenant_id: tenantId } : {}),
        ...(coords || {}),
      };
      const res = await base44.functions.invoke('submitPublicReport', payload);
      const data = res?.data || res;
      if (data?.success) setResult(data);
      else setError(data?.error || 'Could not submit your report. Please try again.');
    } catch (e) {
      setError(e.message || 'Could not submit your report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <CheckCircle2 className="w-14 h-14 mx-auto text-green-500" />
          <h1 className="text-xl font-bold font-jakarta">Report submitted</h1>
          <p className="text-sm text-muted-foreground">{result.message}</p>
          <p className="text-sm">Reference: <span className="font-mono font-semibold">{result.reference}</span></p>
          <Button variant="outline" onClick={() => { setResult(null); setDescription(''); setBinCode(''); setCoords(null); }}>
            Submit another report
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary text-white px-4 pt-8 pb-10">
        <div className="max-w-md mx-auto">
          <h1 className="text-xl font-bold font-jakarta flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> Report a Waste Issue</h1>
          <p className="text-sm text-white/80 mt-1">Help keep your community clean. No account needed.</p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 -mt-5 space-y-4 pb-10">
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">What's the issue?</label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map(c => (
                <button
                  key={c.value}
                  onClick={() => setCategory(c.value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all text-left ${
                    category === c.value ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  <c.icon className="w-3.5 h-3.5 shrink-0" /> {c.label}
                </button>
              ))}
            </div>
          </div>

          <Field label="Describe what you see *">
            <textarea
              rows={3}
              className="w-full border border-input bg-background rounded-lg px-3 py-2 text-sm resize-none"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Pile of household waste dumped at the roadside near…"
            />
          </Field>

          <Field label="Bin code (if reporting a specific bin)">
            <input className="w-full border border-input bg-background rounded-lg px-3 py-2 text-sm" value={binCode} onChange={e => setBinCode(e.target.value)} placeholder="e.g. KLA-0142" />
          </Field>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Location</label>
            <Button type="button" variant="outline" className="w-full gap-2" onClick={captureLocation} disabled={locating}>
              {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
              {coords ? `Location captured (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})` : 'Use my current location'}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Your name (optional)"><input className="w-full border border-input bg-background rounded-lg px-3 py-2 text-sm" value={name} onChange={e => setName(e.target.value)} /></Field>
            <Field label="Phone/email (optional)"><input className="w-full border border-input bg-background rounded-lg px-3 py-2 text-sm" value={contact} onChange={e => setContact(e.target.value)} /></Field>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button className="w-full gap-2" onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {submitting ? 'Submitting…' : 'Submit Report'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}
