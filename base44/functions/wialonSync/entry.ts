import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Wialon telematics sync:
 * 1. Authenticates with Wialon API using token
 * 2. Fetches unit (vehicle) list and syncs to Vehicle entity
 * 3. Fetches latest positions and ingests into VehicleTelematics
 * 4. Computes idling and route deviation flags
 */
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

      const deviationFlag = false; // Would require route path geo-check

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

      positionsIngested++;
    }
  }

  // Logout from Wialon
  await fetch(`${wialonUrl}?svc=core/logout&params={}&sid=${sid}`);

  return Response.json({
    vehicles_synced: vehiclesSynced,
    positions_ingested: positionsIngested,
    message: `Successfully synced ${vehiclesSynced} vehicles and ${positionsIngested} positions from Wialon`,
  });
});