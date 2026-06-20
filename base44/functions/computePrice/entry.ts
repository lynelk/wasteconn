import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Evaluates active PricingRules for a tenant and returns an itemised price breakdown
// No auth required — callable from public quoting flows

function evaluateCondition(conditionJson, context) {
  if (!conditionJson) return true;
  try {
    const condition = typeof conditionJson === 'string' ? JSON.parse(conditionJson) : conditionJson;
    for (const [key, value] of Object.entries(condition)) {
      if (key === 'min_weight_kg' && context.estimated_weight_kg < value) return false;
      if (key === 'max_weight_kg' && context.estimated_weight_kg > value) return false;
      if (key === 'min_distance_km' && context.distance_km < value) return false;
      if (key === 'waste_type' && context.waste_type !== value) return false;
      if (key === 'customer_type' && context.customer_type !== value) return false;
      if (key === 'is_after_hours' && context.is_after_hours !== value) return false;
      if (key === 'is_bulky' && context.is_bulky !== value) return false;
      if (key === 'is_hazardous' && context.is_hazardous !== value) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function computeAmount(rule, context) {
  const amount = rule.amount || 0;
  switch (rule.amount_type) {
    case 'flat': return amount;
    case 'per_km': return amount * (context.distance_km || 0);
    case 'per_kg': return amount * (context.estimated_weight_kg || 0);
    case 'percentage': return Math.round((amount / 100) * (context.base_amount || 0));
    default: return 0;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const {
      tenant_id,
      zone_id,
      customer_type,
      waste_type,
      estimated_weight_kg = 0,
      distance_km = 0,
      is_after_hours = false,
      is_bulky = false,
      is_hazardous = false,
      base_amount_ugx = 0,
    } = body;

    if (!tenant_id) return Response.json({ error: 'tenant_id required' }, { status: 400 });

    const today = new Date().toISOString().split('T')[0];

    // Fetch all active rules for this tenant
    const allRules = await base44.asServiceRole.entities.PricingRule.filter(
      { tenant_id, active: true },
      'priority',
      200
    );

    // Filter by date validity and scope
    const applicableRules = allRules.filter(rule => {
      if (rule.effective_from && rule.effective_from > today) return false;
      if (rule.effective_to && rule.effective_to < today) return false;

      // Scope filtering
      if (rule.scope === 'zone' && rule.scope_id && rule.scope_id !== zone_id) return false;
      if (rule.scope === 'customer_type' && rule.scope_id && rule.scope_id !== customer_type) return false;
      if (rule.scope === 'waste_type' && rule.scope_id && rule.scope_id !== waste_type) return false;

      return true;
    });

    const context = {
      zone_id, customer_type, waste_type,
      estimated_weight_kg, distance_km,
      is_after_hours, is_bulky, is_hazardous,
      base_amount: base_amount_ugx,
    };

    const surcharges = [];
    let runningTotal = base_amount_ugx;

    for (const rule of applicableRules) {
      if (!evaluateCondition(rule.condition_json, context)) continue;

      // Update base for percentage calculations
      context.base_amount = runningTotal;
      const surchargeAmount = Math.round(computeAmount(rule, context));

      if (surchargeAmount > 0) {
        surcharges.push({
          rule_id: rule.id,
          rule_name: rule.name,
          rule_type: rule.rule_type,
          amount_type: rule.amount_type,
          amount_ugx: surchargeAmount,
        });
        runningTotal += surchargeAmount;
      }
    }

    return Response.json({
      base_amount_ugx,
      surcharges,
      total_ugx: runningTotal,
      rules_evaluated: applicableRules.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});