import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Wialon telematics sync:
 * 1. Authenticates with Wialon API using token
 * 2. Fetches unit (vehicle) list and syncs to Vehicle entity
 * 3. Fetches latest positions and ingests into VehicleTelematics
 * 4. Computes idling and route deviation flags
 */

const ROUTE_DEVIATION_THRESHOLD_M = 500;
const EARTH_RADIUS_M = 6_371_000;

function pointToSegmentMeters(pLat, pLng, aLat, aLng, bLat, bLng) {
  const toRad = (d) => (d * Math.PI) / 180;
  const refLat = toRad((aLat + bLat) / 2);
  const x = (lng) => toRad(lng) * Math.cos(refLat) * EARTH_RADIUS_M;
  const y = (lat) => toRad(lat) * EARTH_RADIUS_M;
  const px = x(pLng), py = y(pLat);
  const ax = x(aLng), ay = y(aLat);
  const bx = x(bLng), by = y(bLat);
  const dx = bx - ax, dy = by - ay;
  const segLenSq = dx * dx + dy * dy;
  if (segLenSq === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / segLenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function distanceToPolylineMeters(pLat, pLng, coords) {
  if (!coords || coords.length === 0) return Infinity;
  if (coords.length === 1) {
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(coords[0][1] - pLat);
    const dLng = toRad(coords[0][0] - pLng);
    const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(toRad(pLat)) * Math.cos(toRad(coords[0][1]));
    return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  let min = Infinity;
  for (let i = 0; i < coords.length - 1; i++) {
    const d = pointToSegmentMeters(pLat, pLng, coords[i][1], coords[i][0], coords[i + 1][1], coords[i + 1][0]);
    if (d < min) min = d;
  }
  return min;
}

function parseLineString(geojson) {
  if (!geojson) return [];
  try {
    const obj = typeof geojson === 'string' ? JSON.parse(geojson) : geojson;
    if (Array.isArray(obj?.coordinates)) return obj.coordinates;
    if (obj?.geometry?.type === 'LineString' && Array.isArray(obj.geometry.coordinates)) return obj.geometry.coordinates;
    if (Array.isArray(obj)) return obj;
  } catch { /* malformed geojson */ }
  return [];
}
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || !['admin', 'super_admin'].includes(user.role)) {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }

  const wialonToken = Deno.env.get('WIALON_API_TOKEN');
  const wialonUrl = Deno.env.get('WIALON_API_URL') || 'https://hst-api.wialon.com/wialon/ajax.php';

  if (!wialonToken) {
    // Return stub response if no token configured
    return Response.json({
      vehicles_synced: 0,
      positions_ingested: 0,
      message: 'Wialon token not configured. Set WIALON_API_TOKEN secret to enable live sync.',
      stub: true,
    });
  }

  // Step 1: Login to Wialon
  const loginRes = await fetch(`${wialonUrl}?svc=token/login&params={"token":"${wialonToken}"}`);
  const loginData = await loginRes.json();

  if (loginData.error) {
    return Response.json({ error: `Wialon login failed: ${loginData.error}` }, { status: 500 });
  }

  const sid = loginData.eid;

  // Step 2: Get units list
  const unitsRes = await fetch(`${wialonUrl}?svc=core/search_items&params={"spec":{"itemsType":"avl_unit","propName":"sys_name","propValueMask":"*","sortType":"sys_name"},"force":1,"flags":1025,"from":0,"to":0}&sid=${sid}`);
  const unitsData = await unitsRes.json();
  const units = unitsData.items || [];

  let vehiclesSynced = 0;
  let positionsIngested = 0;
  let deviationAlerts = 0;

  // Fetch existing vehicles
  const existingVehicles = await base44.asServiceRole.entities.Vehicle.list();

  for (const unit of units) {
    // Match by registration number or create
    let vehicle = existingVehicles.find(v =>
      v.registration_number === unit.nm ||
      v.notes?.includes(`wialon:${unit.id}`)
    );

    if (!vehicle) {
      vehicle = await base44.asServiceRole.entities.Vehicle.create({
        registration_number: unit.nm,
        make: 'Unknown',
        model: unit.cls?.toString() || 'Unit',
        status: 'active',
        notes: `wialon:${unit.id}`,
      });
    }

    vehiclesSynced++;

    // Step 3: Get last position
    if (unit.pos) {
      const pos = unit.pos;
      const idleSeconds = pos.s === 0 && pos.t ? Math.min((Date.now()/1000 - pos.t), 7200) : 0;

      // Check existing routes for deviation
      const routes = await base44.asServiceRole.entities.Route.filter({ vehicle_id: vehicle.id });
      const activeRoute = routes.find(r => r.status === 'in_progress');

      // Route deviation: distance from current position to the planned route polyline
      let deviationFlag = false;
      let deviationMeters = 0;
      if (activeRoute?.path_geojson) {
        const coords = parseLineString(activeRoute.path_geojson);
        if (coords.length > 0) {
          deviationMeters = distanceToPolylineMeters(pos.y, pos.x, coords);
          deviationFlag = deviationMeters > ROUTE_DEVIATION_THRESHOLD_M;
        }
      }

      await base44.asServiceRole.entities.VehicleTelematics.create({
        vehicle_id: vehicle.id,
        registration_number: unit.nm,
        latitude: pos.y,
        longitude: pos.x,
        speed_kmh: pos.s || 0,
        heading: pos.c || 0,
        ignition_on: pos.s > 0,
        engine_idle_seconds: Math.round(idleSeconds),
        odometer_km: unit.mileage || 0,
        fuel_level_pct: null,
        provider: 'wialon',
        provider_unit_id: unit.id?.toString(),
        route_id: activeRoute?.id || null,
        timestamp: new Date(pos.t * 1000).toISOString(),
        is_active: true,
        deviation_alert_sent: deviationFlag,
      });

      // Raise a FleetAlert on deviation, deduped to one open alert per vehicle+route
      if (deviationFlag && activeRoute) {
        const existingAlerts = await base44.asServiceRole.entities.FleetAlert.filter({
          vehicle_id: vehicle.id,
          alert_type: 'route_deviation',
          status: 'new',
        });
        const alreadyOpen = existingAlerts.some(a => a.route_id === activeRoute.id);
        if (!alreadyOpen) {
          await base44.asServiceRole.entities.FleetAlert.create({
            tenant_id: activeRoute.tenant_id || vehicle.tenant_id,
            vehicle_id: vehicle.id,
            registration_number: unit.nm,
            driver_id: activeRoute.driver_id || null,
            alert_type: 'route_deviation',
            severity: deviationMeters > ROUTE_DEVIATION_THRESHOLD_M * 4 ? 'high' : 'medium',
            message: `Vehicle ${unit.nm} is ${Math.round(deviationMeters)}m off its planned route "${activeRoute.route_name || activeRoute.id}".`,
            latitude: pos.y,
            longitude: pos.x,
            route_id: activeRoute.id,
            deviation_meters: Math.round(deviationMeters),
            status: 'new',
          });
          deviationAlerts++;
        }
      }

      positionsIngested++;
    }
  }

  // Logout from Wialon
  await fetch(`${wialonUrl}?svc=core/logout&params={}&sid=${sid}`);

  return Response.json({
    vehicles_synced: vehiclesSynced,
    positions_ingested: positionsIngested,
    deviation_alerts: deviationAlerts,
    message: `Successfully synced ${vehiclesSynced} vehicles and ${positionsIngested} positions from Wialon`,
  });
});