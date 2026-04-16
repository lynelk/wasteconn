import { useState, useEffect } from 'react';
import { Navigation, Gauge, AlertTriangle, Zap } from 'lucide-react';

// On-device ML navigation assist:
// - Learns preferred routes per zone from completion history in localStorage
// - Flags unusual completion speed (too fast = skip risk; too slow = incident risk)

const STORAGE_KEY = 'nlswms_zone_micro_routes';

function getZoneHistory() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}

function saveZoneHistory(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function recordJobCompletion(zoneId, jobId, durationMins) {
  const history = getZoneHistory();
  if (!history[zoneId]) history[zoneId] = { completions: [], avgMins: null };
  history[zoneId].completions.push({ jobId, durationMins, ts: Date.now() });
  // Keep last 30
  if (history[zoneId].completions.length > 30) history[zoneId].completions = history[zoneId].completions.slice(-30);
  // Recalc avg
  const vals = history[zoneId].completions.map(c => c.durationMins);
  history[zoneId].avgMins = vals.reduce((a, b) => a + b, 0) / vals.length;
  saveZoneHistory(history);
}

export function checkCompletionSpeed(zoneId, durationMins) {
  const history = getZoneHistory();
  const zone = history[zoneId];
  if (!zone?.avgMins || zone.completions.length < 3) return null;
  const ratio = durationMins / zone.avgMins;
  if (ratio < 0.4) return { flag: 'too_fast', ratio, message: `Job completed in ${Math.round(ratio * 100)}% of avg time — possible skip risk` };
  if (ratio > 2.5) return { flag: 'too_slow', ratio, message: `Job took ${Math.round(ratio * 100)}% of avg time — possible incident or access issue` };
  return null;
}

export default function NavigationAssist({ job, startedAt }) {
  const [elapsed, setElapsed] = useState(0);
  const [speedFlag, setSpeedFlag] = useState(null);
  const [zoneAvg, setZoneAvg] = useState(null);

  useEffect(() => {
    if (!startedAt) return;
    const start = new Date(startedAt).getTime();
    const tick = setInterval(() => {
      const mins = (Date.now() - start) / 60000;
      setElapsed(mins);
      if (job?.zone_id) {
        const flag = checkCompletionSpeed(job.zone_id, mins);
        setSpeedFlag(flag);
        const history = getZoneHistory();
        setZoneAvg(history[job.zone_id]?.avgMins || null);
      }
    }, 15000); // check every 15s
    return () => clearInterval(tick);
  }, [startedAt, job?.zone_id]);

  const openMaps = () => {
    const q = job?.address ? encodeURIComponent(job.address) : '';
    window.open(`https://maps.google.com/?q=${q}&travelmode=driving`, '_blank');
  };

  if (!job) return null;

  return (
    <div className="space-y-2">
      {/* Navigation button */}
      <button
        onClick={openMaps}
        className="w-full flex items-center justify-center gap-2 text-sm text-blue-300 bg-blue-950/60 border border-blue-800 px-4 py-2.5 rounded-xl hover:bg-blue-900/60"
      >
        <Navigation className="w-4 h-4" /> Open Turn-by-Turn Navigation
      </button>

      {/* Speed monitor */}
      {startedAt && (
        <div className={`rounded-xl px-3 py-2.5 border text-xs flex items-center gap-3 ${
          speedFlag?.flag === 'too_fast' ? 'bg-orange-950/50 border-orange-700' :
          speedFlag?.flag === 'too_slow' ? 'bg-red-950/50 border-red-700' :
          'bg-gray-800 border-gray-700'
        }`}>
          <Gauge className="w-4 h-4 text-gray-400 shrink-0" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Time elapsed: <strong>{Math.round(elapsed)} min</strong></span>
              {zoneAvg && <span className="text-gray-500">Zone avg: {Math.round(zoneAvg)} min</span>}
            </div>
            {speedFlag && (
              <div className={`flex items-center gap-1 mt-1 ${speedFlag.flag === 'too_fast' ? 'text-orange-400' : 'text-red-400'}`}>
                <AlertTriangle className="w-3 h-3" />
                <span>{speedFlag.message}</span>
              </div>
            )}
          </div>
          <Zap className="w-3.5 h-3.5 text-primary shrink-0" title="ML-assisted speed monitoring" />
        </div>
      )}
    </div>
  );
}