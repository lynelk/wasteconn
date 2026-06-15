import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Demand-driven (fill-level) collection planner.
// Selects only the containers that are at/over their collection threshold — or
// forecast to overflow before the next run — and clusters them into
// nearest-neighbour collection routes per zone. This complements the
// job-based aiRouteOptimiser by routing on real sensor demand instead of a
// fixed schedule, avoiding trips to half-empty bins.

const DEFAULT_FULL_PCT = 80;
const DEFAULT_HORIZON_DAYS = 1;
// Kampala CBD fallback when a container has no coordinates.
const FALLBACK_LAT = 0.3163;
const FALLBACK_LNG = 32.5811;

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function predictDaysToFull(currentPct, dailyRate) {
  if (typeof currentPct !== 'number' || !Number.isFinite(currentPct)) return null;
  if (typeof dailyRate !== 'number' || !Number.isFinite(dailyRate) || dailyRate <= 0) return null;
  const remaining = 100 - currentPct;
  if (remaining <= 0) return 0;
  return remaining / dailyRate;
}

function needsCollection(container, horizonDays) {
  const fill = container.last_fill_pct;
  const threshold = typeof container.collection_threshold_pct === 'number'
    ? container.collection_threshold_pct
    : DEFAULT_FULL_PCT;
  if (typeof fill === 'number' && Number.isFinite(fill) && fill >= threshold) return true;
  const daysToFull = predictDaysToFull(fill, container.avg_daily_fill_rate_pct);
  return daysToFull !== null && daysToFull <= horizonDays;
}

// Nearest-neighbour ordering of stops within a single zone.
function orderByProximity(containers) {
  if (containers.length <= 1) return containers.slice();
  const remaining = containers.slice();
  const ordered = [remaining.shift()];
  while (remaining.length > 0) {
    const last = ordered[ordered.length - 1];
    const lat = last.latitude ?? FALLBACK_LAT;
    const lng = last.longitude ?? FALLBACK_LNG;
    remaining.sort((a, b) =>
      haversineKm(lat, lng, a.latitude ?? FALLBACK_LAT, a.longitude ?? FALLBACK_LNG) -
      haversineKm(lat, lng, b.latitude ?? FALLBACK_LAT, b.longitude ?? FALLBACK_LNG)
    );
    ordered.push(remaining.shift());
  }
  return ordered;
}

function buildPlan(containers) {
  // Group due containers by zone; hazardous streams are isolated per zone.
  const byZone = {};
  for (const c of containers) {
    const zid = c.zone_id || 'unzoned';
    const key = c.waste_stream === 'hazardous' ? `${zid}::hazardous` : zid;
    (byZone[key] ||= []).push(c);
  }

  const plans = [];
  for (const [key, group] of Object.entries(byZone)) {
    const ordered = orderByProximity(group);
    let distKm = 0;
    for (let i = 1; i < ordered.length; i++) {
      distKm += haversineKm(
        ordered[i - 1].latitude ?? FALLBACK_LAT, ordered[i - 1].longitude ?? FALLBACK_LNG,
        ordered[i].latitude ?? FALLBACK_LAT, ordered[i].longitude ?? FALLBACK_LNG
      );
    }
    const [zoneId, stream] = key.split('::');
    plans.push({
      zone_id: zoneId,
      isolation_required: stream === 'hazardous',
      waste_streams: [...new Set(ordered.map(c => c.waste_stream))],
      container_ids: ordered.map(c => c.id),
      stops: ordered.length,
      estimated_distance_km: Math.round(distKm * 10) / 10,
      estimated_duration_mins: Math.round(ordered.length * 8 + distKm * 3),
    });
  }
  return plans.sort((a, b) => b.stops - a.stops);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const zoneId = body.zone_id;
    const horizonDays = typeof body.horizon_days === 'number' ? body.horizon_days : DEFAULT_HORIZON_DAYS;

    const containers = zoneId
      ? await base44.asServiceRole.entities.Container.filter({ status: 'active', zone_id: zoneId })
      : await base44.asServiceRole.entities.Container.filter({ status: 'active' });

    const due = containers.filter(c => needsCollection(c, horizonDays));

    if (due.length === 0) {
      return Response.json({
        success: true,
        plans: [],
        containers_total: containers.length,
        containers_due: 0,
        summary: 'No containers due for collection within the horizon.',
      });
    }

    const plans = buildPlan(due);
    return Response.json({
      success: true,
      plans,
      containers_total: containers.length,
      containers_due: due.length,
      horizon_days: horizonDays,
      summary: `Demand-driven plan: ${due.length}/${containers.length} containers due across ${plans.length} zone route(s).`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
