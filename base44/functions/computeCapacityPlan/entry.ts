import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  const secret = req.headers.get('x-capacity-secret');
  if (secret !== Deno.env.get('CAPACITY_SECRET') && Deno.env.get('CAPACITY_SECRET')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const base44 = createClientFromRequest(req);

  // Get all tenants
  const tenants = await base44.asServiceRole.entities.Tenant.list();
  const results = [];

  const today = new Date();
  const planDate = new Date(today);
  planDate.setDate(today.getDate() + 1);
  const planDateStr = planDate.toISOString().split('T')[0];

  for (const tenant of tenants) {
    const tid = tenant.id;

    // Get zones
    const zones = await base44.asServiceRole.entities.ServiceZone.filter({ tenant_id: tid });

    for (const zone of zones) {
      // Scheduled pickups tomorrow
      const scheduledPickups = await base44.asServiceRole.entities.PickupRequest.filter({
        tenant_id: tid,
        zone_id: zone.id,
        scheduled_date: planDateStr,
        request_type: 'scheduled',
        status: 'pending'
      });

      // On-demand historical average (last 30 days same weekday)
      const allPickups = await base44.asServiceRole.entities.PickupRequest.filter({
        tenant_id: tid,
        zone_id: zone.id,
        request_type: 'on_demand',
        status: 'completed'
      });

      const dayOfWeek = planDate.getDay();
      const sameDay = allPickups.filter(p => {
        const d = new Date(p.completed_at || p.scheduled_date);
        return d.getDay() === dayOfWeek;
      });
      const avgOnDemand = sameDay.length > 0 ? sameDay.length / 4 : 0;

      // Subscriptions
      const subs = await base44.asServiceRole.entities.Subscription.filter({
        tenant_id: tid,
        zone_id: zone.id,
        status: 'active'
      });

      const forecastStops = scheduledPickups.length + Math.round(avgOnDemand) + subs.length;

      // Available vehicles (not in maintenance, assigned to zone)
      const vehicles = await base44.asServiceRole.entities.Vehicle.filter({
        tenant_id: tid,
        assigned_zone_id: zone.id,
        status: 'available'
      });

      const plannedCapacityT = vehicles.reduce((sum, v) => sum + (v.capacity_tonnes || 0) * 0.9, 0);
      const forecastDemandT = forecastStops * 0.3; // ~300kg avg per stop
      const utilisationPct = plannedCapacityT > 0 ? Math.round((forecastDemandT / plannedCapacityT) * 100) : 0;
      const status = utilisationPct > 100 ? 'over' : utilisationPct > 80 ? 'tight' : 'ok';

      // Upsert
      const existing = await base44.asServiceRole.entities.CapacityPlan.filter({
        tenant_id: tid,
        zone_id: zone.id,
        plan_date: planDateStr
      });

      const payload = {
        tenant_id: tid,
        zone_id: zone.id,
        plan_date: planDateStr,
        forecast_demand_t: forecastDemandT,
        forecast_stops: forecastStops,
        available_vehicles: vehicles.length,
        planned_capacity_t: plannedCapacityT,
        utilisation_pct: utilisationPct,
        status
      };

      if (existing.length > 0) {
        await base44.asServiceRole.entities.CapacityPlan.update(existing[0].id, payload);
      } else {
        await base44.asServiceRole.entities.CapacityPlan.create(payload);
      }

      results.push({ zone: zone.id, status, utilisationPct });
    }
  }

  return Response.json({ ok: true, plans: results });
});