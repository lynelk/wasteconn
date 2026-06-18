import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow both scheduled (no auth needed, service role) and manual calls
    // For manual calls from admin frontend, verify user role
    let isScheduled = false;
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    isScheduled = body?.scheduled === true;

    if (!isScheduled) {
      const user = await base44.auth.me();
      if (user?.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Determine current quarter date range
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const quarterIndex = Math.floor(month / 3);
    const quarterStart = new Date(year, quarterIndex * 3, 1);
    const quarterEnd = new Date(year, quarterIndex * 3 + 3, 0);
    const fmt = (d) => d.toISOString().split('T')[0];

    // Get all vehicles with a quarterly budget set
    const allVehicles = await base44.asServiceRole.entities.Vehicle.list();
    const budgetedVehicles = allVehicles.filter(v => v.quarterly_maintenance_budget_ugx > 0);

    if (budgetedVehicles.length === 0) {
      return Response.json({ message: 'No vehicles with quarterly budgets configured.', alerts: [] });
    }

    // Get all work orders for the current quarter
    const allOrders = await base44.asServiceRole.entities.MaintenanceWorkOrder.list();
    const quarterOrders = allOrders.filter(wo => {
      const d = wo.completed_date || wo.scheduled_date || wo.created_date?.split('T')[0];
      return d >= fmt(quarterStart) && d <= fmt(quarterEnd) && wo.status !== 'cancelled';
    });

    // Aggregate costs per vehicle
    const costByVehicle = {};
    for (const wo of quarterOrders) {
      if (!wo.vehicle_id) continue;
      if (!costByVehicle[wo.vehicle_id]) costByVehicle[wo.vehicle_id] = 0;
      costByVehicle[wo.vehicle_id] += (wo.parts_cost_ugx || 0) + (wo.labour_cost_ugx || 0) + (wo.hired_truck_cost_ugx || 0) + (wo.hired_driver_cost_ugx || 0);
    }

    // Check which vehicles exceed their budget
    const exceeded = [];
    for (const vehicle of budgetedVehicles) {
      const totalCost = costByVehicle[vehicle.id] || 0;
      const budget = vehicle.quarterly_maintenance_budget_ugx;
      if (totalCost > budget) {
        exceeded.push({ vehicle, totalCost, budget, overage: totalCost - budget });
      }
    }

    if (exceeded.length === 0) {
      return Response.json({ message: 'All vehicles within quarterly budget.', alerts: 0 });
    }

    // Send a single Slack alert summarising all over-budget vehicles
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('slackbot');

    const lines = exceeded.map(({ vehicle, totalCost, budget, overage }) =>
      `• *${vehicle.registration_number}* (${vehicle.vehicle_type}) — Budget: UGX ${budget.toLocaleString()} | Actual: UGX ${totalCost.toLocaleString()} | *Overage: UGX ${overage.toLocaleString()}*`
    ).join('\n');

    const quarterLabel = `Q${quarterIndex + 1} ${year}`;
    const text = `:warning: *Fleet Maintenance Budget Alert — ${quarterLabel}*\n\n${exceeded.length} vehicle(s) have exceeded their quarterly maintenance budget:\n\n${lines}\n\n_Immediate review recommended._`;

    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: '#fleet-alerts',
        text,
        username: 'Fleet Manager',
        icon_emoji: ':truck:',
      }),
    });

    return Response.json({ alerted: true, alertCount: exceeded.length, exceeded: exceeded.map(e => ({ reg: e.vehicle.registration_number, totalCost: e.totalCost, budget: e.budget, overage: e.overage })) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});