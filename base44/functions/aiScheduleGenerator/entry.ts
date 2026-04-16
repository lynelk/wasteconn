import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// AI Schedule Generator
// Generates recurring pickup schedules for a customer based on:
// - Their service plan frequency
// - Zone collection days
// - Historical demand patterns
// - Requested horizon (days)

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !['admin', 'super_admin', 'dispatcher'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { customer_id, subscription_id, horizon_days = 30, start_date } = body;

    if (!customer_id) return Response.json({ error: 'customer_id required' }, { status: 400 });

    // Gather context
    const [customers, subs, zones, existingPickups] = await Promise.all([
      base44.asServiceRole.entities.Customer.filter({ id: customer_id }),
      subscription_id
        ? base44.asServiceRole.entities.Subscription.filter({ id: subscription_id })
        : base44.asServiceRole.entities.Subscription.filter({ customer_id, status: 'active' }),
      base44.asServiceRole.entities.ServiceZone.list(),
      base44.asServiceRole.entities.PickupRequest.filter({ customer_id, status: 'completed' }, '-completed_at', 30),
    ]);

    const customer = customers?.[0];
    if (!customer) return Response.json({ error: 'Customer not found' }, { status: 404 });

    const sub = subs?.[0];
    const zone = zones.find(z => z.id === customer.zone_id);

    // Get plan details
    let plan = null;
    if (sub?.plan_id) {
      const plans = await base44.asServiceRole.entities.ServicePlan.filter({ id: sub.plan_id });
      plan = plans?.[0];
    }

    const fromDate = start_date || new Date().toISOString().slice(0, 10);
    const toDate = new Date(new Date(fromDate).getTime() + horizon_days * 86400000).toISOString().slice(0, 10);

    // Historical avg weight per pickup
    const avgWeight = existingPickups.length > 0
      ? existingPickups.reduce((s, p) => s + (p.actual_weight_kg || p.estimated_weight_kg || 20), 0) / existingPickups.length
      : 20;

    // Generate schedule using LLM
    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a waste management scheduling AI for a company in Uganda.

Generate an optimal pickup schedule for:
- Customer: ${customer.full_name} (${customer.customer_type})
- Zone: ${zone?.zone_name || 'Unknown'} — collects on: ${(zone?.collection_days || []).join(', ')}
- Zone collection time: ${zone?.collection_time || '07:00-10:00'}
- Service plan: ${plan?.plan_name || 'Standard'} — frequency: ${plan?.frequency || 'weekly'}
- Address: ${customer.address || 'zone-level'}
- Historical avg weight per pickup: ${avgWeight.toFixed(1)} kg
- Period: ${fromDate} to ${toDate} (${horizon_days} days)

Generate pickup dates that:
1. Fall on the zone's collection days
2. Match the plan frequency (daily/twice_weekly/weekly/biweekly/monthly)
3. Are idempotent — do not overlap with existing pickups

Return a list of scheduled pickups for this period.`,
      response_json_schema: {
        type: 'object',
        properties: {
          pickups: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                scheduled_date: { type: 'string', description: 'YYYY-MM-DD' },
                scheduled_time: { type: 'string', description: 'e.g. 07:00-10:00' },
                estimated_weight_kg: { type: 'number' },
                waste_type: { type: 'string', enum: ['general', 'recyclable', 'organic', 'hazardous', 'bulky'] },
                notes: { type: 'string' },
              },
            },
          },
          summary: { type: 'string' },
          frequency_detected: { type: 'string' },
        },
      },
    });

    // Persist generated schedule
    const created = [];
    const errors = [];

    for (const pickup of (result.pickups || [])) {
      // Check idempotency
      const existing = await base44.asServiceRole.entities.PickupRequest.filter({
        customer_id,
        scheduled_date: pickup.scheduled_date,
      });
      if (existing?.length > 0) continue;

      const newPickup = await base44.asServiceRole.entities.PickupRequest.create({
        tenant_id: customer.tenant_id,
        customer_id,
        zone_id: customer.zone_id,
        request_type: 'scheduled',
        status: 'pending',
        scheduled_date: pickup.scheduled_date,
        scheduled_time: pickup.scheduled_time,
        estimated_weight_kg: pickup.estimated_weight_kg || avgWeight,
        waste_type: pickup.waste_type || 'general',
        notes: pickup.notes || `AI-scheduled — ${plan?.plan_name || 'Standard'} plan`,
      });
      created.push(newPickup);
    }

    return Response.json({
      success: true,
      created_count: created.length,
      summary: result.summary,
      frequency: result.frequency_detected,
      pickups: created,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});