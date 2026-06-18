import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    // Called from entity automation: payload has event + data
    const vehicleId = body?.data?.vehicle_id;
    if (!vehicleId) {
      return Response.json({ skipped: true, reason: 'No vehicle_id in payload' });
    }

    // Get the vehicle record
    const vehicles = await base44.asServiceRole.entities.Vehicle.filter({ id: vehicleId });
    const vehicle = vehicles[0];
    if (!vehicle || !vehicle.quarterly_maintenance_budget_ugx) {
      return Response.json({ skipped: true, reason: 'No budget set for vehicle' });
    }

    // Determine current quarter date range
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const quarterStart = new Date(year, Math.floor(month / 3) * 3, 1);
    const quarterEnd = new Date(year, Math.floor(month / 3) * 3 + 3, 0);
    const fmt = (d) => d.toISOString().split('T')[0];

    // Fetch all completed/in_progress work orders for this vehicle this quarter
    const allOrders = await base44.asServiceRole.entities.MaintenanceWorkOrder.filter({
      vehicle_id: vehicleId
    });

    const quarterOrders = allOrders.filter(wo => {
      const d = wo.completed_date || wo.scheduled_date || wo.created_date?.split('T')[0];
      return d >= fmt(quarterStart) && d <= fmt(quarterEnd) && wo.status !== 'cancelled';
    });

    const totalCost = quarterOrders.reduce((sum, wo) => {
      return sum + (wo.parts_cost_ugx || 0) + (wo.labour_cost_ugx || 0) + (wo.hired_truck_cost_ugx || 0) + (wo.hired_driver_cost_ugx || 0);
    }, 0);

    const budget = vehicle.quarterly_maintenance_budget_ugx;

    if (totalCost <= budget) {
      return Response.json({ alerted: false, totalCost, budget });
    }

    // Budget exceeded — send Slack alert
    const overage = totalCost - budget;
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('slackbot');

    const message = {
      channel: '#fleet-alerts',
      text: `⚠️ *Maintenance Budget Exceeded*\n*Vehicle:* ${vehicle.registration_number} (${vehicle.make_model || vehicle.vehicle_type})\n*Quarter:* Q${Math.floor(month / 3) + 1} ${year}\n*Budget:* UGX ${budget.toLocaleString()}\n*Actual Cost:* UGX ${totalCost.toLocaleString()}\n*Overage:* UGX ${overage.toLocaleString()}\n\nImmediate review recommended.`,
      username: 'Fleet Manager',
      icon_emoji: ':truck:',
    };

    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    return Response.json({ alerted: true, totalCost, budget, overage });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});