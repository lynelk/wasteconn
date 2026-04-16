import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, X, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function DuplicateCheckBanner({ fullName, phone, email, onDismiss }) {
  const [checking, setChecking] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (dismissed) return;
    const timeout = setTimeout(async () => {
      if (!fullName || fullName.length < 3) return;
      setChecking(true);
      try {
        const res = await base44.functions.invoke('aiDuplicateCustomerCheck', { full_name: fullName, phone, email });
        setCandidates(res.data?.candidates || []);
      } catch {
        // silent fail
      } finally {
        setChecking(false);
      }
    }, 800);
    return () => clearTimeout(timeout);
  }, [fullName, phone, email, dismissed]);

  if (dismissed || (!checking && candidates.length === 0)) return null;

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-orange-800">
              {checking ? 'Checking for duplicate accounts...' : `${candidates.length} potential duplicate(s) detected`}
            </p>
            {!checking && candidates.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {candidates.map(c => (
                  <div key={c.customer_id} className="flex items-center gap-2 text-xs text-orange-700">
                    <span className="font-medium">{c.customer_name}</span>
                    <span>·</span>
                    <span>{c.phone || c.email}</span>
                    <Badge variant="secondary" className={`text-xs ${c.risk === 'high' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                      {c.match_score}% match
                    </Badge>
                    <span className="text-orange-500">{c.match_reasons.join(', ')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <button onClick={() => { setDismissed(true); onDismiss?.(); }} className="text-orange-400 hover:text-orange-600 shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}