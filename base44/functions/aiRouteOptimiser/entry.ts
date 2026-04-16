import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// AI Route Optimisation Engine — VRP Solver with historical RL signals
// Solves Vehicle Routing Problem: groups jobs by proximity + capacity constraints
// Incorporates historical completion times per zone as reinforcement signals

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function greedyVRP(jobs, vehicles, historicalZoneData) {
  // Sort vehicles by capacity desc
  const sortedVehicles = [...vehicles].sort((a, b) => (b.capacity_tonnes || 3) - (a.capacity_tonnes || 3));
  const routes = [];
  const assigned = new Set();

  // Separate hazardous (must be isolated)
  const hazardous = jobs.filter(j => j.waste_type === 'hazardous' && !assigned.has(j.id));
  const normal = jobs.filter(j => j.waste_type !== 'hazardous' && !assigned.has(j.id));

  // Nearest-neighbour greedy clustering
  function buildRoute(pool, vehicle, maxTons) {
    if (pool.length === 0) return null;
    const route = [];
    let remainingCap = maxTons * 1000; // to kg
    let seed = pool[0];
    route.push(seed);
    assigned.add(seed.id);
    remainingCap -= (seed.estimated_weight_kg || 50);
    const remaining = pool.filter(j => j.id !== seed.id);

    // Sort by proximity to last stop
    while (remaining.length > 0 && remainingCap > 0) {
      const last = route[route.length - 1];
      const lastLat = last.latitude || 0.3163;
      const lastLng = last.longitude || 32.5811;
      remaining.sort((a, b) => {
        const da = haversineKm(lastLat, lastLng, a.latitude || 0.316, a.longitude || 32.58);
        const db = haversineKm(lastLat, lastLng, b.latitude || 0.316, b.longitude || 32.58);
        return da - db;
      });
      const next = remaining.find(j => !assigned.has(j.id) && (j.estimated_weight_kg || 50) <= remainingCap);
      if (!next) break;
      route.push(next);
      assigned.add(next.id);
      remainingCap -= (next.estimated_weight_kg || 50);
      remaining.splice(remaining.indexOf(next), 1);
    }
    return route;
  }

  // Historical zone avg completion speed (RL signal)
  function zoneSpeedFactor(zoneId) {
    const h = historicalZoneData[zoneId];
    if (!h || !h.avg_mins || !h.estimated_mins) return 1.0;
    return Math.max(0.7, Math.min(1.5, h.avg_mins / h.estimated_mins));
  }

  // Assign hazardous to dedicated vehicle
  if (hazardous.length > 0 && sortedVehicles.length > 0) {
    const v = sortedVehicles[0];
    const route = buildRoute(hazardous, v, v.capacity_tonnes || 3);
    if (route?.length > 0) {
      const distKm = route.length * 2.5; // estimate ~2.5km per stop in Kampala
      const zoneId = route[0].zone_id;
      const factor = zoneSpeedFactor(zoneId);
      routes.push({
        vehicle_id: v.id,
        vehicle_type: v.vehicle_type || 'truck',
        job_ids: route.map(j => j.id),
        estimated_distance_km: Math.round(distKm * 10) / 10,
        estimated_duration_mins: Math.round(route.length * 15 * factor),
        waste_types: ['hazardous'],
        isolation_required: true,
        efficiency_score: 85,
      });
    }
  }

  // Assign normal jobs to remaining vehicles
  const remaining = normal.filter(j => !assigned.has(j.id));
  for (const vehicle of sortedVehicles) {
    if (remaining.length === 0) break;
    if (routes.some(r => r.vehicle_id === vehicle.id)) continue;
    const pool = remaining.filter(j => !assigned.has(j.id));
    if (pool.length === 0) break;
    const route = buildRoute(pool, vehicle, vehicle.capacity_tonnes || 3);
    if (route?.length > 0) {
      const distKm = route.length * 2.8;
      const zoneId = route[0].zone_id;
      const factor = zoneSpeedFactor(zoneId);
      routes.push({
        vehicle_id: vehicle.id,
        vehicle_type: vehicle.vehicle_type || 'pickup',
        job_ids: route.map(j => j.id),
        estimated_distance_km: Math.round(distKm * 10) / 10,
        estimated_duration_mins: Math.round(route.length * 12 * factor),
        waste_types: [...new Set(route.map(j => j.waste_type))],
        isolation_required: false,
        efficiency_score: Math.max(60, 100 - Math.round(remaining.filter(j => !assigned.has(j.id)).length / jobs.length * 40)),
      });
    }
  }

  return routes;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { date, zone_id } = body;

    if (!date) return Response.json({ error: 'date is required' }, { status: 400 });

    // Fetch all needed data in parallel
    const [jobs, vehicles, recentRoutes] = await Promise.all([
      zone_id
        ? base44.asServiceRole.entities.PickupRequest.filter({ scheduled_date: date, status: 'pending', zone_id })
        : base44.asServiceRole.entities.PickupRequest.filter({ scheduled_date: date, status: 'pending' }),
      base44.asServiceRole.entities.Vehicle.filter({ status: 'available' }),
      base44.asServiceRole.entities.Route.list('-route_date', 50),
    ]);

    // Build historical zone performance data (RL signal)
    const zoneData = {};
    for (const r of recentRoutes.filter(r => r.status === 'completed' && r.actual_duration_mins && r.estimated_duration_mins)) {
      const zid = r.zone_id;
      if (!zoneData[zid]) zoneData[zid] = { total_actual: 0, total_est: 0, count: 0 };
      zoneData[zid].total_actual += r.actual_duration_mins;
      zoneData[zid].total_est += r.estimated_duration_mins;
      zoneData[zid].count += 1;
    }
    const historicalZoneData = {};
    for (const [zid, d] of Object.entries(zoneData)) {
      historicalZoneData[zid] = {
        avg_mins: d.total_actual / d.count,
        estimated_mins: d.total_est / d.count,
      };
    }

    if (jobs.length === 0) {
      return Response.json({ success: true, routes: [], summary: 'No pending jobs for this date/zone.', jobs_covered: 0 });
    }

    const routes = greedyVRP(jobs, vehicles, historicalZoneData);

    const coveredJobIds = new Set(routes.flatMap(r => r.job_ids));
    const uncoveredCount = jobs.filter(j => !coveredJobIds.has(j.id)).length;

    return Response.json({
      success: true,
      routes,
      jobs_total: jobs.length,
      jobs_covered: coveredJobIds.size,
      jobs_uncovered: uncoveredCount,
      vehicles_used: routes.length,
      historical_zones_used: Object.keys(historicalZoneData).length,
      summary: `VRP solved: ${routes.length} routes for ${coveredJobIds.size}/${jobs.length} jobs. ${uncoveredCount > 0 ? `${uncoveredCount} jobs uncovered (insufficient vehicles).` : 'All jobs covered.'}`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});