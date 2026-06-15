import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// entityAggregate — generic, guard-railed group-by count/sum so the long tail of
// analytics screens doesn't each need a bespoke function. See AGGREGATION_SPECS.
//
// Request:
//   { entity, where?, group_by?, metrics: [{ op: 'count' } | { op: 'sum', field }] }
// Guard-rails: entity + fields must be allow-listed; results are tenant-scoped;
// group cardinality is capped.

const PAGE = 1000;
const SAFETY_CAP = 500_000;
const MAX_GROUPS = 1000;

// Allow-list: which entities can be aggregated and on which fields.
const ALLOW = {
  PickupRequest: { group: ['zone_id', 'status', 'waste_type'], sum: ['estimated_weight_kg'] },
  Payment: { group: ['status', 'payment_method'], sum: ['amount_ugx'] },
  Invoice: { group: ['status'], sum: ['amount_ugx'] },
  Customer: { group: ['zone_id', 'customer_type', 'customer_segment', 'status'], sum: [] },
  Complaint: { group: ['status', 'category', 'priority'], sum: [] },
  Subscription: { group: ['status', 'plan_id'], sum: ['amount_ugx'] },
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { entity, where = {}, group_by = null, metrics = [{ op: 'count' }] } = body;

    const rules = ALLOW[entity];
    if (!rules) return Response.json({ error: `Entity '${entity}' not allowed` }, { status: 400 });
    if (group_by && !rules.group.includes(group_by)) {
      return Response.json({ error: `group_by '${group_by}' not allowed for ${entity}` }, { status: 400 });
    }
    const sumFields = metrics.filter((m) => m.op === 'sum').map((m) => m.field);
    for (const f of sumFields) {
      if (!rules.sum.includes(f)) return Response.json({ error: `sum field '${f}' not allowed` }, { status: 400 });
    }
    const wantCount = metrics.some((m) => m.op === 'count');

    const tenantId = user.role === 'super_admin' ? (body.tenant_id || null) : user.tenant_id;
    const q = { ...where };
    if (tenantId) q.tenant_id = tenantId;
    // Only allow filtering on allow-listed group fields (plus tenant_id).
    for (const k of Object.keys(where)) {
      if (k !== 'tenant_id' && !rules.group.includes(k)) {
        return Response.json({ error: `where field '${k}' not allowed` }, { status: 400 });
      }
    }

    const fields = ['id', ...(group_by ? [group_by] : []), ...sumFields];

    const groups = new Map();
    let skip = 0;
    let batch;
    do {
      batch = await base44.asServiceRole.entities[entity].filter(q, '-created_date', PAGE, skip, fields);
      for (const row of batch) {
        const key = group_by ? (row[group_by] ?? '∅') : '__all__';
        let g = groups.get(key);
        if (!g) {
          if (groups.size >= MAX_GROUPS) continue;
          g = { group: key, count: 0 };
          for (const f of sumFields) g[`sum_${f}`] = 0;
          groups.set(key, g);
        }
        if (wantCount) g.count += 1;
        for (const f of sumFields) g[`sum_${f}`] += row[f] || 0;
      }
      skip += PAGE;
    } while (batch.length === PAGE && skip < SAFETY_CAP);

    return Response.json({
      success: true,
      data: [...groups.values()],
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
