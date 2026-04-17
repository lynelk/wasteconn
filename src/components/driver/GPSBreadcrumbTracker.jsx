/**
 * GPSBreadcrumbTracker — On-device GPS path recorder for micro-route ML learning.
 *
 * Collects GPS breadcrumbs during a job and stores them keyed by job ID.
 * Breadcrumbs are used to:
 *   - Learn driver-preferred micro-routes via NavigationAssist
 *   - Estimate distance / fuel efficiency
 *   - Provide proof-of-service GPS trail uploaded on job completion
 */

const BREADCRUMB_KEY_PREFIX = 'nlswms_gps_trail_';

/**
 * Append a GPS point to the in-progress job's trail.
 * Each point: { lat, lng, ts, speed_kmh?, heading? }
 */
export function appendBreadcrumb(jobId, lat, lng, extras = {}) {
  if (!jobId) return;
  const key = `${BREADCRUMB_KEY_PREFIX}${jobId}`;
  try {
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    existing.push({ lat, lng, ts: Date.now(), ...extras });
    // Cap at 500 points per job (~2h at 15s intervals)
    const capped = existing.length > 500 ? existing.slice(-500) : existing;
    localStorage.setItem(key, JSON.stringify(capped));
  } catch (_) {}
}

/**
 * Retrieve the GPS trail for a job. Returns array of breadcrumb points.
 */
export function getBreadcrumbs(jobId) {
  if (!jobId) return [];
  try {
    return JSON.parse(localStorage.getItem(`${BREADCRUMB_KEY_PREFIX}${jobId}`) || '[]');
  } catch {
    return [];
  }
}

/**
 * Clear breadcrumbs for a job (call after successful upload / completion).
 */
export function clearBreadcrumbs(jobId) {
  if (!jobId) return;
  localStorage.removeItem(`${BREADCRUMB_KEY_PREFIX}${jobId}`);
}

/**
 * Estimate total distance (km) from a breadcrumb trail using Haversine.
 */
export function estimateDistanceKm(breadcrumbs) {
  if (!breadcrumbs || breadcrumbs.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < breadcrumbs.length; i++) {
    const prev = breadcrumbs[i - 1];
    const curr = breadcrumbs[i];
    const R = 6371;
    const dLat = (curr.lat - prev.lat) * Math.PI / 180;
    const dLng = (curr.lng - prev.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(prev.lat*Math.PI/180)*Math.cos(curr.lat*Math.PI/180)*Math.sin(dLng/2)**2;
    total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }
  return Math.round(total * 100) / 100;
}