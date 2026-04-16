import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Scheduled weekly — analyses vehicle fuel/mileage trends with AI
// Creates MaintenanceWorkOrder for high-risk vehicles

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow manual trigger by admin, or automated scheduler (no user)
    let isAdmin = false;
    try {
      const user = await base44.auth.me();
      isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
    } catch {
      // Called by scheduler — treat as service role
      isAdmin = true;
    }

    if (!isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const vehicles = await base44.asServiceRole.entities.Vehicle.list();
    const fuelLogs = await base44.asServiceRole.entities.FuelLog.list('-fuel_date', 200);
    const workOrders = await base44.asServiceRole.entities.MaintenanceWorkOrder.list('-created_date', 50);

    if (vehicles.length === 0) return Response.json({ skipped: true, reason: 'No vehicles' });

    // Build per-vehicle fuel summary
    const vehicleSummaries = vehicles.map(v => {
      const logs = fuelLogs.filter(f => f.vehicle_id === v.id).slice(0, 10);
      const avgEfficiency = logs.length > 0
        ? (logs.reduce((s, l) => s + (l.efficiency_km_per_litre || 0), 0) / logs.length).toFixed(2)
        : null;
      const totalFuelCost = logs.reduce((s, l) => s + (l.cost_ugx || 0), 0);
      const recentOpenWO = workOrders.filter(w => w.vehicle_id === v.id && w.status === 'open');

      const lastServiceDaysAgo = v.last_service_date
        ? Math.floor((Date.now() - new Date(v.last_service_date).getTime()) / 86400000)
        : null;

      return {
        id: v.id,
        registration: v.registration_number,
        type: v.vehicle_type,
        status: v.status,
        make_model: v.make_model || 'Unknown',
        year: v.year,
        fuel_entries: logs.length,
        avg_efficiency_km_per_litre: avgEfficiency,
        total_fuel_cost_ugx: totalFuelCost,
        last_service_days_ago: lastServiceDaysAgo,
        next_service_date: v.next_service_date,
        open_work_orders: recentOpenWO.length,
        tenant_id: v.tenant_id,
      };
    });

    const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
      model: 'claude_sonnet_4_6',
      prompt: `You are an expert fleet maintenance AI for a waste management company operating in Uganda.

Analyse the following vehicle fleet data and identify which vehicles have a HIGH risk of mechanical failure within the next 30 days.

Use these risk factors:
- Low or declining fuel efficiency (below 4 km/L for trucks, below 6 km/L for pickups)
- Last service date older than 90 days → moderate risk, >180 days → high risk
- Overdue next_service_date (compare vs today: ${new Date().toISOString().split('T')[0]})
- Multiple open work orders already
- High cumulative fuel cost (may indicate engine inefficiency)
- Vehicle status = maintenance already (skip these)

For each HIGH-risk vehicle only, produce:
- vehicle_id
- registration_number
- risk_score (0-100)
- failure_prediction: short description of likely fault
- recommended_action: specific maintenance action
- priority: "high" or "critical"

Only include vehicles with risk_score >= 65.

FLEET DATA:
${JSON.stringify(vehicleSummaries, null, 2)}`,
      response_json_schema: {
        type: 'object',
        properties: {
          high_risk_vehicles: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                vehicle_id: { type: 'string' },
                registration_number: { type: 'string' },
                risk_score: { type: 'number' },
                failure_prediction: { type: 'string' },
                recommended_action: { type: 'string' },
                priority: { type: 'string' },
              }
            }
          },
          summary: { type: 'string' },
        }
      }
    });

    const created = [];
    for (const v of (res.high_risk_vehicles || [])) {
      // Skip if a predictive work order already exists for this vehicle this month
      const thisMonth = new Date().toISOString().slice(0, 7);
      const hasRecent = workOrders.some(w =>
        w.vehicle_id === v.vehicle_id &&
        w.order_type === 'predictive' &&
        w.created_date?.startsWith(thisMonth)
      );
      if (hasRecent) continue;

      const vehicleData = vehicleSummaries.find(vs => vs.id === v.vehicle_id);
      const wo = await base44.asServiceRole.entities.MaintenanceWorkOrder.create({
        tenant_id: vehicleData?.tenant_id || '',
        vehicle_id: v.vehicle_id,
        order_type: 'predictive',
        title: `AI Alert: ${v.failure_prediction}`,
        description: `${v.recommended_action}\n\nAI Risk Score: ${v.risk_score}/100\nRegistration: ${v.registration_number}`,
        status: 'open',
        priority: v.priority === 'critical' ? 'critical' : 'high',
        ai_prediction_score: v.risk_score,
        scheduled_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
        notes: `Auto-generated by AI Predictive Maintenance. ${res.summary || ''}`,
      });
      created.push(wo.id);
    }

    return Response.json({
      success: true,
      vehiclesAnalysed: vehicles.length,
      highRiskFound: res.high_risk_vehicles?.length || 0,
      workOrdersCreated: created.length,
      summary: res.summary,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});