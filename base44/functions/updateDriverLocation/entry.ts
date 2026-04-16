import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow unauthenticated GPS device calls with a token, or authenticated driver calls
    let driverId = null;
    let driverName = 'Unknown Driver';
    let tenantId = '';

    try {
      const user = await base44.auth.me();
      if (user) {
        driverId = user.id;
        driverName = user.full_name || user.email;
      }
    } catch (_) {}

    const body = await req.json();
    const { latitude, longitude, accuracy_meters, heading, speed_kmh, route_id, current_job_id, tenant_id, device_driver_id, device_driver_name } = body;

    // GPS device may pass driver_id directly (for dedicated GPS hardware)
    if (!driverId && device_driver_id) {
      driverId = device_driver_id;
      driverName = device_driver_name || 'GPS Device';
      tenantId = tenant_id || '';
    }

    if (!driverId) {
      return Response.json({ error: 'driver_id required' }, { status: 400 });
    }

    if (latitude == null || longitude == null) {
      return Response.json({ error: 'latitude and longitude required' }, { status: 400 });
    }

    // Upsert: check for existing record for this driver
    const existing = await base44.asServiceRole.entities.DriverLocation.filter({ driver_id: driverId });

    const locationData = {
      driver_id: driverId,
      driver_name: driverName,
      tenant_id: tenantId || tenant_id || '',
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      accuracy_meters: accuracy_meters ? parseFloat(accuracy_meters) : null,
      heading: heading ? parseFloat(heading) : null,
      speed_kmh: speed_kmh ? parseFloat(speed_kmh) : null,
      route_id: route_id || null,
      current_job_id: current_job_id || null,
      timestamp: new Date().toISOString(),
      is_active: true,
    };

    let result;
    if (existing.length > 0) {
      result = await base44.asServiceRole.entities.DriverLocation.update(existing[0].id, locationData);
    } else {
      result = await base44.asServiceRole.entities.DriverLocation.create(locationData);
    }

    return Response.json({ success: true, location_id: result.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});