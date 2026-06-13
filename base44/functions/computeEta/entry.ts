import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Live ETA for a customer's pickup: distance from the assigned driver's latest
// position to the pickup location, divided by speed (with an urban floor).
// Auth: any authenticated user (customer-facing). Payload: { pickup_id }.

const EARTH_RADIUS_M = 6_371_000;
function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(toRad(aLat)) * Math.cos(toRad(bLat));
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { pickup_id } = await req.json();
    if (!pickup_id) return Response.json({ error: 'pickup_id required' }, { status: 400 });

    const pickup = await base44.asServiceRole.entities.PickupRequest.get(pickup_id);
    if (!pickup) return Response.json({ error: 'Pickup not found' }, { status: 404 });
    if (!pickup.assigned_driver_id) {
      return Response.json({ success: true, available: false, reason: 'No driver assigned yet' });
    }

    // --- Destination: pickup coords, else its service point ---
    let destLat = pickup.latitude;
    let destLng = pickup.longitude;
    if ((destLat == null || destLng == null) && pickup.service_point_id) {
      const sp = await base44.asServiceRole.entities.ServicePoint.get(pickup.service_point_id).catch(() => null);
      if (sp) { destLat = sp.latitude; destLng = sp.longitude; }
    }
    if (destLat == null || destLng == null) {
      return Response.json({ success: true, available: false, reason: 'Pickup location coordinates unavailable' });
    }

    // --- Latest driver position (DriverLocation, fallback VehicleTelematics) ---
    let pos = null;
    const locs = await base44.asServiceRole.entities.DriverLocation.filter({ driver_id: pickup.assigned_driver_id, is_active: true });
    if (locs?.length) {
      pos = locs.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())[0];
    }
    if (!pos) {
      return Response.json({ success: true, available: false, reason: 'Driver location not available yet' });
    }

    const distanceMeters = haversineMeters(pos.latitude, pos.longitude, destLat, destLng);
    const speedKmh = Math.max(pos.speed_kmh || 0, 15); // urban floor
    const etaMinutes = Math.max(1, Math.round((distanceMeters / 1000 / speedKmh) * 60));

    const ageMs = pos.timestamp ? Date.now() - new Date(pos.timestamp).getTime() : Infinity;
    const stale = ageMs > 5 * 60 * 1000;

    return Response.json({
      success: true,
      available: true,
      distance_km: Math.round((distanceMeters / 1000) * 10) / 10,
      eta_minutes: etaMinutes,
      driver_speed_kmh: pos.speed_kmh ?? null,
      position_timestamp: pos.timestamp || null,
      stale,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
