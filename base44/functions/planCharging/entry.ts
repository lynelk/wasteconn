import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  const secret = req.headers.get('x-charge-secret');
  if (secret !== Deno.env.get('CHARGE_SECRET') && Deno.env.get('CHARGE_SECRET')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const base44 = createClientFromRequest(req);
  const tenants = await base44.asServiceRole.entities.Tenant.list();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const results = [];

  for (const tenant of tenants) {
    const tid = tenant.id;

    // Get all EV vehicles
    const vehicles = await base44.asServiceRole.entities.Vehicle.filter({
      tenant_id: tid,
      fuel_type: 'electric'
    });

    if (!vehicles.length) continue;

    // Get tomorrow's routes
    const routes = await base44.asServiceRole.entities.Route.filter({
      tenant_id: tid,
      route_date: tomorrowStr
    });

    // Get available chargers
    const chargers = await base44.asServiceRole.entities.Charger.filter({
      tenant_id: tid,
      status: 'available'
    });

    // Calculate energy needed per vehicle based on assigned routes
    const vehicleNeeds = vehicles.map(v => {
      const assignedRoute = routes.find(r => r.vehicle_id === v.id);
      const distanceKm = assignedRoute?.estimated_distance_km || 50; // default 50km
      const efficiency = v.efficiency_kwh_per_km || 0.3;
      const energyNeededKwh = distanceKm * efficiency;
      const currentEnergyKwh = ((v.current_soc_pct || 100) / 100) * (v.battery_capacity_kwh || 100);
      const deficit = energyNeededKwh - currentEnergyKwh;
      return {
        vehicle: v,
        energyNeededKwh,
        currentEnergyKwh,
        deficit,
        soc: v.current_soc_pct || 100,
        routeDistanceKm: distanceKm
      };
    });

    // Sort by lowest SoC relative to route need (most urgent first)
    vehicleNeeds.sort((a, b) => {
      const aRatio = a.currentEnergyKwh / (a.energyNeededKwh || 1);
      const bRatio = b.currentEnergyKwh / (b.energyNeededKwh || 1);
      return aRatio - bRatio;
    });

    // Emit alerts for vehicles with insufficient charge
    for (const vn of vehicleNeeds) {
      if (vn.deficit > 0) {
        await base44.asServiceRole.entities.IntegrationQueue.create({
          tenant_id: tid,
          event_type: 'vehicle.low_soc',
          payload: JSON.stringify({
            vehicle_id: vn.vehicle.id,
            registration: vn.vehicle.registration_number,
            current_soc_pct: vn.soc,
            energy_needed_kwh: vn.energyNeededKwh,
            current_energy_kwh: vn.currentEnergyKwh,
            deficit_kwh: vn.deficit,
            route_distance_km: vn.routeDistanceKm
          }),
          status: 'pending'
        });
      }
    }

    // Assign vehicles to chargers (greedy sequencing)
    const chargerQueue = [...chargers];
    const chargingPlan = [];

    for (const vn of vehicleNeeds) {
      if (!chargerQueue.length) break;
      if (vn.deficit <= 0 && vn.soc >= 80) continue; // Already sufficient

      const charger = chargerQueue.shift();
      const timeNeededHours = (vn.deficit > 0 ? vn.deficit : (100 - vn.soc) / 100 * (vn.vehicle.battery_capacity_kwh || 100)) / (charger.power_kw || 7);

      chargingPlan.push({
        vehicle_id: vn.vehicle.id,
        registration: vn.vehicle.registration_number,
        charger_id: charger.id,
        charger_name: charger.name,
        estimated_charge_hours: Math.round(timeNeededHours * 10) / 10,
        priority_soc: vn.soc
      });
    }

    results.push({ tenant: tid, lowSocAlerts: vehicleNeeds.filter(v => v.deficit > 0).length, chargingPlan });
  }

  return Response.json({ ok: true, results });
});