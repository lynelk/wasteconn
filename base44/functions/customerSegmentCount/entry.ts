import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// customerSegmentCount — audience size for a marketing segment, without
// downloading the audience. Powers the MarketingHub recipient preview.
// The actual send must run server-side (see sendSmsCampaign in
// docs/AGGREGATION_SPECS.md). Replaces MarketingHub's Customer.list() scan.

const PAGE = 1000;
const SAFETY_CAP = 500_000;

async function countMatching(entity, where) {
  let skip = 0;
  let total = 0;
  let batch;
  do {
    // Project to id only — we just need the count.
    batch = await entity.filter(where, '-created_date', PAGE, skip, ['id']);
    total += batch.length;
    skip += PAGE;
  } while (batch.length === PAGE && skip < SAFETY_CAP);
  return total;
}

// Allow-list of fields a segment may filter on (prevents arbitrary scans).
const SEGMENT_FIELDS = ['zone_id', 'customer_type', 'customer_segment', 'district', 'status'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const tenantId = user.role === 'super_admin' ? (body.tenant_id || null) : user.tenant_id;

    const where = {};
    if (tenantId) where.tenant_id = tenantId;
    const segment = body.segment || {};
    for (const f of SEGMENT_FIELDS) {
      if (segment[f] !== undefined && segment[f] !== '' && segment[f] !== null) where[f] = segment[f];
    }

    const count = await countMatching(base44.asServiceRole.entities.Customer, where);
    return Response.json({ success: true, data: { count }, generated_at: new Date().toISOString(), cached: false });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
