import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Asset Health Engine — runs weekly.
// Analyses BOTH fleet vehicles (fuel/mileage trends) AND container assets
// (smart bins + skips), branching logic per asset_category.
// Creates MaintenanceWorkOrder records for high-risk assets.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let isAdmin = false;
    try {
      const user = await base44.auth.me();
      isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
    } catch {
      isAdmin = true; // scheduler
    }
    if (!isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const today = new Date().toISOString().split('T')[0];
    const thisMonth = new Date().toISOString().slice(0, 7);

    // ── Fetch all assets concurrently ─────────────────────────────────────
    const [vehicles, fuelLogs, workOrders, containers] = await Promise.all([
      base44.asServiceRole.entities.Vehicle.list(),
      base44.asServiceRole.entities.FuelLog.list('-fuel_date', 200),
      base44.asServiceRole.entities.MaintenanceWorkOrder.list('-created_date', 100),
      base44.asServiceRole.entities.Container.list(),
    ]);

    const created = [];

    // ═══════════════════════════════════════════════════════════════════════
    // 1. VEHICLE ANALYSIS (unchanged logic, fleet health)
    // ═══════════════════════════════════════════════════════════════════════
    if (vehicles.length > 0) {
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

      const vehicleRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
        model: 'claude_sonnet_4_6',
        prompt: `You are an expert fleet maintenance AI for a waste management company in Uganda.

Analyse the following vehicle fleet data and identify vehicles with HIGH risk of mechanical failure within 30 days.

Risk factors:
- Low/declining fuel efficiency (below 4 km/L trucks, below 6 km/L pickups)
- Last service > 90 days ago → moderate, > 180 days → high risk
- Overdue next_service_date (today: ${today})
- Multiple open work orders
- High cumulative fuel cost (engine inefficiency indicator)
- Skip vehicles with status = "maintenance" already

For each HIGH-risk vehicle (risk_score >= 65), produce:
- vehicle_id, registration_number, risk_score (0-100), failure_prediction, recommended_action, priority ("high"|"critical")

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

      for (const v of (vehicleRes.high_risk_vehicles || [])) {
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
          title: `AI Fleet Alert: ${v.failure_prediction}`,
          description: `${v.recommended_action}\n\nAI Risk Score: ${v.risk_score}/100\nRegistration: ${v.registration_number}`,
          status: 'open',
          priority: v.priority === 'critical' ? 'critical' : 'high',
          ai_prediction_score: v.risk_score,
          scheduled_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
          notes: `Auto-generated by Asset Health Engine (vehicle). ${vehicleRes.summary || ''}`,
        });
        created.push({ type: 'vehicle', id: wo.id, ref: v.registration_number });
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 2. CONTAINER ASSET ANALYSIS — branches on asset_category
    //    smart_bin: analyse avg_daily_fill_rate_pct, last_battery_pct, signal age
    //    skip:      analyse avg_daily_weight_gain_kg, last_weight_kg, capacity
    // ═══════════════════════════════════════════════════════════════════════
    const activeContainers = containers.filter(c => c.status === 'active');
    if (activeContainers.length > 0) {
      const nowMs = Date.now();

      const containerSummaries = activeContainers.map(c => {
        const lastReadingAgeHours = c.last_reading_at
          ? Math.round((nowMs - Date.parse(c.last_reading_at)) / 3_600_000)
          : null;
        const lastMaintenanceDaysAgo = c.last_maintenance_at
          ? Math.floor((nowMs - Date.parse(c.last_maintenance_at)) / 86_400_000)
          : null;

        const base = {
          id: c.id,
          label: c.label || c.qr_code || c.id,
          asset_category: c.asset_category || 'smart_bin',
          waste_stream: c.waste_stream,
          zone_id: c.zone_id,
          tenant_id: c.tenant_id,
          last_fill_pct: c.last_fill_pct,
          last_reading_age_hours: lastReadingAgeHours,
          last_maintenance_days_ago: lastMaintenanceDaysAgo,
        };

        if (c.asset_category === 'skip') {
          return {
            ...base,
            max_weight_kg: c.max_weight_kg,
            last_weight_kg: c.last_weight_kg,
            avg_daily_weight_gain_kg: c.avg_daily_weight_gain_kg,
          };
        } else {
          return {
            ...base,
            capacity_litres: c.capacity_litres,
            last_battery_pct: c.last_battery_pct,
            avg_daily_fill_rate_pct: c.avg_daily_fill_rate_pct,
          };
        }
      });

      const containerRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
        model: 'claude_sonnet_4_6',
        prompt: `You are an IoT asset health AI for a waste management platform in Uganda.

Analyse the following container assets (smart bins and skips) and identify those with HIGH maintenance risk within the next 14 days.

== SMART BIN risk factors (asset_category = "smart_bin") ==
- Sensor silent for > 48 hours (last_reading_age_hours) → possible sensor failure
- Battery below 15% → urgent replacement
- avg_daily_fill_rate_pct is null after 7+ days → possible sensor malfunction
- No maintenance in > 180 days → scheduled service due

== SKIP risk factors (asset_category = "skip") ==
- last_weight_kg is null or last_reading_age_hours > 72 → sensor/scale failure
- avg_daily_weight_gain_kg unusually high (> 80% of max_weight_kg per day) → overflow risk
- last_fill_pct >= 90 and avg_daily_weight_gain_kg > 0 → imminent overflow
- No maintenance in > 90 days → inspection due

For each HIGH-risk container (risk_score >= 60) produce:
- container_id, label, asset_category, risk_score (0-100), issue_description, recommended_action, priority ("medium"|"high"|"critical")

Only include assets with risk_score >= 60. Today is ${today}.

ASSET DATA:
${JSON.stringify(containerSummaries, null, 2)}`,
        response_json_schema: {
          type: 'object',
          properties: {
            high_risk_containers: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  container_id: { type: 'string' },
                  label: { type: 'string' },
                  asset_category: { type: 'string' },
                  risk_score: { type: 'number' },
                  issue_description: { type: 'string' },
                  recommended_action: { type: 'string' },
                  priority: { type: 'string' },
                }
              }
            },
            summary: { type: 'string' },
          }
        }
      });

      for (const c of (containerRes.high_risk_containers || [])) {
        // Dedup: skip if a predictive WO already exists for this container this month
        const hasRecent = workOrders.some(w =>
          w.container_id === c.container_id &&
          w.order_type === 'predictive' &&
          w.created_date?.startsWith(thisMonth)
        );
        if (hasRecent) continue;

        const containerData = containerSummaries.find(cs => cs.id === c.container_id);
        const wo = await base44.asServiceRole.entities.MaintenanceWorkOrder.create({
          tenant_id: containerData?.tenant_id || '',
          container_id: c.container_id,
          order_type: 'predictive',
          title: `AI Asset Alert [${c.asset_category === 'skip' ? 'Skip' : 'Bin'}]: ${c.issue_description}`,
          description: `${c.recommended_action}\n\nAI Risk Score: ${c.risk_score}/100\nAsset: ${c.label}`,
          status: 'open',
          priority: c.priority === 'critical' ? 'critical' : c.priority === 'high' ? 'high' : 'medium',
          ai_prediction_score: c.risk_score,
          scheduled_date: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
          notes: `Auto-generated by Asset Health Engine (${c.asset_category}). ${containerRes.summary || ''}`,
        });
        created.push({ type: c.asset_category, id: wo.id, ref: c.label });
      }
    }

    return Response.json({
      success: true,
      vehiclesAnalysed: vehicles.length,
      containersAnalysed: activeContainers.length,
      workOrdersCreated: created.length,
      workOrders: created,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});