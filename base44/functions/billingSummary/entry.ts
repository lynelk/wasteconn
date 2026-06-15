import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// billingSummary — invoice counts + revenue/outstanding sums for BillingPage.
// Replaces the in-browser Invoice.list() scan. See docs/AGGREGATION_SPECS.md.

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
    // Optional month filter on invoice_month / billing period (string "YYYY-MM").
    if (body.month) where.invoice_month = body.month;

    const invoices = await scan(base44.asServiceRole.entities.Invoice, where, ['status', 'amount_ugx']);

    const sumWhere = (pred) => invoices.filter(pred).reduce((s, i) => s + (i.amount_ugx || 0), 0);
    const data = {
      total_issued: invoices.filter((i) => i.status === 'issued').length,
      total_paid: invoices.filter((i) => i.status === 'paid').length,
      total_overdue: invoices.filter((i) => i.status === 'overdue').length,
      revenue_ugx: sumWhere((i) => i.status === 'paid'),
      outstanding_ugx: sumWhere((i) => ['issued', 'overdue', 'partially_paid'].includes(i.status)),
    };

    return Response.json({ success: true, data, generated_at: new Date().toISOString(), cached: false });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
