import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// paymentsSummary — header totals for the Payments page (completed sum, flagged
// count, breakdown by method). The paginated payments table stays a bounded
// list() on the client; this only supplies the summary. See AGGREGATION_SPECS.

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

const METHODS = ['mtn_momo', 'airtel_money', 'cash', 'bank_transfer', 'yo_payments'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const tenantId = user.role === 'super_admin' ? (body.tenant_id || null) : user.tenant_id;
    const where = {};
    if (tenantId) where.tenant_id = tenantId;
    if (body.from || body.to) {
      where.payment_date = {};
      if (body.from) where.payment_date.$gte = body.from;
      if (body.to) where.payment_date.$lte = body.to;
    }

    const payments = await scan(base44.asServiceRole.entities.Payment, where, ['status', 'amount_ugx', 'payment_method']);

    const by_method = Object.fromEntries(METHODS.map((m) => [m, 0]));
    let total_completed_ugx = 0;
    let flagged_count = 0;
    for (const p of payments) {
      if (p.status === 'completed') {
        total_completed_ugx += p.amount_ugx || 0;
        if (p.payment_method in by_method) by_method[p.payment_method] += 1;
      }
      if (p.status === 'under_review') flagged_count += 1;
    }

    const data = { total_completed_ugx, flagged_count, by_method };
    return Response.json({ success: true, data, generated_at: new Date().toISOString(), cached: false });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
