import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Navigation, Gauge, AlertTriangle, Zap, ThumbsUp, ThumbsDown, Minus, Route } from 'lucide-react';

// ─── On-Device ML Store Keys ──────────────────────────────────────────────────
const ZONE_HISTORY_KEY = 'nlswms_zone_micro_routes';
const MICRO_ROUTES_KEY  = 'nlswms_preferred_micro_routes';

// ─── Zone History Helpers (completion speed learning) ─────────────────────────
function getZoneHistory() {
  try { return JSON.parse(localStorage.getItem(ZONE_HISTORY_KEY) || '{}'); } catch { return {}; }
}
function saveZoneHistory(data) {
  localStorage.setItem(ZONE_HISTORY_KEY, JSON.stringify(data));
}

// ─── Micro-Route Helpers (driver-preferred path learning) ─────────────────────
function getMicroRoutes() {
  try { return JSON.parse(localStorage.getItem(MICRO_ROUTES_KEY) || '{}'); } catch { return {}; }
}
function saveMicroRoutes(data) {
  localStorage.setItem(MICRO_ROUTES_KEY, JSON.stringify(data));
}

/**
 * Computes a zone-level "cell key" from lat/lng (0.01° ≈ 1.1km grid)
 * Used to cluster GPS trace segments into learnable micro-route fragments.
 */
function cellKey(lat, lng) {
  return `${(lat * 100).toFixed(0)}_${(lng * 100).toFixed(0)}`;
}

/**
 * Haversine distance in km between two points
 */
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/**
 * Estimate fuel consumption (litres) from distance + stops.
 * Kampala stop-start: ~12L/100km urban baseline, +0.05L per stop
 */
function estimateFuelL(distanceKm, stopCount) {
  return (distanceKm * 12 / 100) + (stopCount * 0.05);
}

// ─── Exported: record a completed job into zone learning model ────────────────
export function recordJobCompletion(zoneId, jobId, durationMins, gpsBreadcrumbs = [], feedback = 'neutral') {
  // 1. Update zone completion speed history
  const history = getZoneHistory();
  if (!history[zoneId]) history[zoneId] = { completions: [], avgMins: null, stdDev: null };

  history[zoneId].completions.push({ jobId, durationMins, ts: Date.now(), feedback });
  if (history[zoneId].completions.length > 50) {
    history[zoneId].completions = history[zoneId].completions.slice(-50);
  }

  const vals = history[zoneId].completions.map(c => c.durationMins);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const variance = vals.reduce((sum, v) => sum + (v - avg)**2, 0) / vals.length;
  history[zoneId].avgMins = avg;
  history[zoneId].stdDev = Math.sqrt(variance);
  saveZoneHistory(history);

  // 2. If GPS breadcrumbs available, learn micro-route segments
  if (gpsBreadcrumbs.length >= 2) {
    const microRoutes = getMicroRoutes();
    if (!microRoutes[zoneId]) microRoutes[zoneId] = {};

    // Walk the breadcrumb trail in pairs → learn transition preferences
    for (let i = 0; i < gpsBreadcrumbs.length - 1; i++) {
      const from = gpsBreadcrumbs[i];
      const to   = gpsBreadcrumbs[i + 1];
      const key  = `${cellKey(from.lat, from.lng)}->${cellKey(to.lat, to.lng)}`;

      if (!microRoutes[zoneId][key]) {
        microRoutes[zoneId][key] = { count: 0, preferred_count: 0, total_duration_mins: 0 };
      }

      microRoutes[zoneId][key].count += 1;
      microRoutes[zoneId][key].total_duration_mins += durationMins;
      if (feedback === 'preferred') microRoutes[zoneId][key].preferred_count += 1;
    }

    // Keep only top 200 most-used segments per zone (memory bound)
    const entries = Object.entries(microRoutes[zoneId]);
    if (entries.length > 200) {
      const sorted = entries.sort((a, b) => b[1].count - a[1].count).slice(0, 200);
      microRoutes[zoneId] = Object.fromEntries(sorted);
    }

    saveMicroRoutes(microRoutes);
  }
}

// ─── Exported: check completion speed anomaly (on-device inference) ───────────
export function checkCompletionSpeed(zoneId, durationMins) {
  const history = getZoneHistory();
  const zone = history[zoneId];
  if (!zone?.avgMins || zone.completions.length < 5) return null;

  const avg = zone.avgMins;
  const std = zone.stdDev || avg * 0.3; // fallback: 30% std
  const ratio = durationMins / avg;

  // Dynamic thresholds: 2.5 std deviations each side
  const tooFastThreshold = Math.max(0.35, (avg - 2.5 * std) / avg);
  const tooSlowThreshold = Math.min(3.0,  (avg + 2.5 * std) / avg);

  if (ratio < tooFastThreshold) {
    return {
      flag: 'too_fast',
      ratio,
      actual_mins: durationMins,
      zone_avg_mins: avg,
      message: `Job completed in ${Math.round(ratio * 100)}% of zone avg (${Math.round(avg)} min) — possible skip risk`,
    };
  }
  if (ratio > tooSlowThreshold) {
    return {
      flag: 'too_slow',
      ratio,
      actual_mins: durationMins,
      zone_avg_mins: avg,
      message: `Job took ${Math.round(ratio * 100)}% of zone avg (${Math.round(avg)} min) — possible incident or access issue`,
    };
  }
  return null;
}

// ─── Exported: get micro-route efficiency hint for a zone ─────────────────────
export function getZoneMicroRouteHint(zoneId) {
  const microRoutes = getMicroRoutes();
  const segments = microRoutes[zoneId];
  if (!segments) return null;

  const entries = Object.values(segments);
  const totalRuns = entries.reduce((s, e) => s + e.count, 0);
  const preferredRuns = entries.reduce((s, e) => s + e.preferred_count, 0);
  if (totalRuns < 3) return null;

  const preferredPct = Math.round((preferredRuns / totalRuns) * 100);
  const avgMinsPerRun = entries.reduce((s, e) => s + e.total_duration_mins, 0) / totalRuns;

  return { totalRuns, preferredPct, avgMinsPerRun: Math.round(avgMinsPerRun) };
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function NavigationAssist({ job, startedAt, gpsBreadcrumbs = [], onRouteFeedback }) {
  const [elapsed, setElapsed]       = useState(0);
  const [speedFlag, setSpeedFlag]   = useState(null);
  const [zoneAvg, setZoneAvg]       = useState(null);
  const [routeHint, setRouteHint]   = useState(null);
  const [flagSent, setFlagSent]     = useState(false);
  const [routeFeedback, setRouteFeedback] = useState(null);

  // Compute estimated distance from breadcrumbs
  const estimatedDistKm = gpsBreadcrumbs.length >= 2
    ? gpsBreadcrumbs.slice(1).reduce((total, pt, i) => {
        const prev = gpsBreadcrumbs[i];
        return total + haversineKm(prev.lat, prev.lng, pt.lat, pt.lng);
      }, 0)
    : 0;

  const estimatedFuelL = estimateFuelL(estimatedDistKm, gpsBreadcrumbs.length);

  // Live timer + speed monitoring
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

        const hint = getZoneMicroRouteHint(job.zone_id);
        setRouteHint(hint);

        // Cloud flag if anomaly detected and not yet sent (after 3 min minimum)
        if (flag && !flagSent && mins > 3) {
          setFlagSent(true);
          base44.functions.invoke('flagUnusualCompletion', {
            pickup_request_id: job.id,
            zone_id: job.zone_id,
            flag: flag.flag,
            ratio: flag.ratio,
            actual_mins: flag.actual_mins,
            zone_avg_mins: flag.zone_avg_mins,
            message: flag.message,
            actual_route_gps_path: JSON.stringify(gpsBreadcrumbs),
            route_distance_km: Math.round(estimatedDistKm * 10) / 10,
          }).catch(() => {}); // fire-and-forget; driver not blocked by cloud call
        }
      }
    }, 15000);

    return () => clearInterval(tick);
  }, [startedAt, job?.zone_id, job?.id, flagSent, estimatedDistKm]);

  const openMaps = () => {
    if (!job) return;
    const q = job.address ? encodeURIComponent(job.address) : '';
    window.open(`https://maps.google.com/?q=${q}&travelmode=driving`, '_blank');
  };

  const handleFeedback = useCallback((fb) => {
    setRouteFeedback(fb);
    if (onRouteFeedback) onRouteFeedback(fb);
  }, [onRouteFeedback]);

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

      {/* Speed + efficiency monitor */}
      {startedAt && (
        <div className={`rounded-xl px-3 py-2.5 border text-xs space-y-1.5 ${
          speedFlag?.flag === 'too_fast' ? 'bg-orange-950/50 border-orange-700' :
          speedFlag?.flag === 'too_slow' ? 'bg-red-950/50 border-red-700' :
          'bg-gray-800 border-gray-700'
        }`}>
          <div className="flex items-center gap-3">
            <Gauge className="w-4 h-4 text-gray-400 shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Elapsed: <strong>{Math.round(elapsed)} min</strong></span>
                {zoneAvg && <span className="text-gray-500">Zone avg: {Math.round(zoneAvg)} min</span>}
              </div>
              {speedFlag && (
                <div className={`flex items-center gap-1 mt-0.5 ${speedFlag.flag === 'too_fast' ? 'text-orange-400' : 'text-red-400'}`}>
                  <AlertTriangle className="w-3 h-3" />
                  <span>{speedFlag.message}</span>
                </div>
              )}
            </div>
            <Zap className="w-3.5 h-3.5 text-primary shrink-0" title="ML-assisted speed monitoring" />
          </div>

          {/* GPS & fuel efficiency row */}
          {gpsBreadcrumbs.length >= 2 && (
            <div className="flex items-center gap-3 text-gray-500 border-t border-gray-700 pt-1.5">
              <Route className="w-3.5 h-3.5 shrink-0" />
              <span>{estimatedDistKm.toFixed(1)} km traced</span>
              <span>·</span>
              <span>~{estimatedFuelL.toFixed(2)} L est. fuel</span>
              <span>·</span>
              <span>{gpsBreadcrumbs.length} pts</span>
            </div>
          )}
        </div>
      )}

      {/* Micro-route learning hint */}
      {routeHint && routeHint.totalRuns >= 3 && (
        <div className="rounded-xl px-3 py-2 bg-primary/10 border border-primary/30 text-xs text-primary flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 shrink-0" />
          <span>
            ML learned {routeHint.totalRuns} runs in this zone — avg {routeHint.avgMinsPerRun} min,{' '}
            {routeHint.preferredPct}% on preferred routes
          </span>
        </div>
      )}

      {/* Driver route feedback */}
      {startedAt && !routeFeedback && (
        <div className="rounded-xl px-3 py-2 bg-gray-800 border border-gray-700 text-xs">
          <p className="text-gray-400 mb-1.5">Rate this route (helps ML learn your preferences):</p>
          <div className="flex gap-2">
            <button
              onClick={() => handleFeedback('preferred')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-950/60 border border-green-700 text-green-400 hover:bg-green-900/60"
            >
              <ThumbsUp className="w-3 h-3" /> Good route
            </button>
            <button
              onClick={() => handleFeedback('neutral')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-700 border border-gray-600 text-gray-300 hover:bg-gray-600"
            >
              <Minus className="w-3 h-3" /> OK
            </button>
            <button
              onClick={() => handleFeedback('suboptimal')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-950/60 border border-red-700 text-red-400 hover:bg-red-900/60"
            >
              <ThumbsDown className="w-3 h-3" /> Bad route
            </button>
          </div>
        </div>
      )}
      {routeFeedback && (
        <div className="rounded-xl px-3 py-1.5 bg-gray-800/60 border border-gray-700 text-xs text-gray-400 flex items-center gap-2">
          <Zap className="w-3 h-3 text-primary" />
          Route feedback "<span className="text-primary">{routeFeedback}</span>" saved — ML model updated
        </div>
      )}
    </div>
  );
}