import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Calorific value weights by waste type (higher = more energy-rich)
const CALORIFIC_WEIGHT = {
  plastic: 1.0,
  mixed: 0.7,
  organic: 0.3,
  paper: 0.5,
  glass: 0.1,
  metal: 0.1,
  e_waste: 0.6,
  textile: 0.6,
  general: 0.5,
  recyclable: 0.4,
  hazardous: 0.2,
  bulky: 0.3
};

Deno.serve(async (req) => {
  const secret = req.headers.get('x-feedstock-secret');
  if (secret !== Deno.env.get('FEEDSTOCK_SECRET') && Deno.env.get('FEEDSTOCK_SECRET')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const base44 = createClientFromRequest(req);

  const today = new Date().toISOString().split('T')[0];
  const tenants = await base44.asServiceRole.entities.Tenant.list();
  const results = [];

  for (const tenant of tenants) {
    const tid = tenant.id;

    const targets = await base44.asServiceRole.entities.FeedstockTarget.filter({ tenant_id: tid });

    for (const target of targets) {
      // Today's completed pickups/waste bank transactions
      const wbTx = await base44.asServiceRole.entities.WasteBankTransaction.filter({
        tenant_id: tid,
        status: 'completed'
      });

      // Total projected weight today
      const projectedT = wbTx.reduce((sum, tx) => sum + (tx.weight_kg || 0) / 1000, 0);
      const targetT = target.target_t_per_day || 0;
      const gapT = projectedT - targetT;
      const status = gapT >= 0 ? (gapT > targetT * 0.2 ? 'surplus' : 'balanced') : 'shortfall';

      // Sourcing plan: find zones with excess capacity if shortfall
      let sourcingPlan = [];
      if (status === 'shortfall') {
        const capacityPlans = await base44.asServiceRole.entities.CapacityPlan.filter({
          tenant_id: tid,
          plan_date: today,
          status: 'ok'
        });
        // Zones with utilisation < 50% have surplus capacity
        const surplusZones = capacityPlans
          .filter(p => (p.utilisation_pct || 0) < 50)
          .sort((a, b) => (a.utilisation_pct || 0) - (b.utilisation_pct || 0))
          .slice(0, 3);

        sourcingPlan = surplusZones.map(z => ({
          zone_id: z.zone_id,
          available_capacity_t: (z.planned_capacity_t || 0) - (z.forecast_demand_t || 0),
          utilisation_pct: z.utilisation_pct
        }));
      }

      const existing = await base44.asServiceRole.entities.FeedstockPlan.filter({
        tenant_id: tid,
        facility_id: target.facility_id,
        plan_date: today
      });

      const payload = {
        tenant_id: tid,
        facility_id: target.facility_id,
        plan_date: today,
        target_t: targetT,
        projected_t: projectedT,
        gap_t: gapT,
        sourcing_plan_json: JSON.stringify(sourcingPlan),
        status
      };

      if (existing.length > 0) {
        await base44.asServiceRole.entities.FeedstockPlan.update(existing[0].id, payload);
      } else {
        await base44.asServiceRole.entities.FeedstockPlan.create(payload);
      }

      results.push({ facility: target.facility_id, status, projectedT, targetT, gapT });
    }
  }

  return Response.json({ ok: true, results });
});