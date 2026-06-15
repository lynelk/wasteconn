import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// zoneCustomerCounts — number of customers per service zone, for ServiceZones.
// Replaces the in-browser Customer.list() that was used only to count per zone.
// See docs/AGGREGATION_SPECS.md.

const PAGE = 1000;
const SAFETY_CAP = 500_000;

async function scan(entity, where, fields) {
  let skip = 0;
  let out = [];
  let batch;
  do {
    batch = await entity.filter(where, '-created_date', PAGE, skip, fields);
    out = out.concat(batch);
    skip += PAGE;
  } while (batch.length === PAGE && skip < SAFETY_CAP);
  return out;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const tenantId = user.role === 'super_admin' ? (body.tenant_id || null) : user.tenant_id;
    const where = {};
    if (tenantId) where.tenant_id = tenantId;

    const customers = await scan(base44.asServiceRole.entities.Customer, where, ['zone_id']);

    const counts = {};
    for (const c of customers) {
      const z = c.zone_id || 'unzoned';
      counts[z] = (counts[z] || 0) + 1;
    }
    const data = Object.entries(counts).map(([zone_id, customer_count]) => ({ zone_id, customer_count }));

    return Response.json({ success: true, data, generated_at: new Date().toISOString(), cached: false });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
