import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Computes per-tenant usage metrics for the current month and upserts a
// TenantUsage row per tenant. Powers platform billing/metering views.
// Auth: admin/super_admin user OR scheduled call (body._scheduled).

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    if (!body._scheduled) {
      const user = await base44.auth.me().catch(() => null);
      if (!user || !['admin', 'super_admin'].includes(user.role)) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const now = new Date();
    const period = body.period || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const periodStart = `${period}-01`;
    // Exclusive upper bound = first day of next month
    const [y, m] = period.split('-').map(Number);
    const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;

    const inPeriod = (dateStr) => {
      if (!dateStr) return false;
      const d = dateStr.slice(0, 10);
      return d >= periodStart && d < nextMonth;
    };

    // Pull entities once, group by tenant in memory
    const [customers, pickups, payments, notifications] = await Promise.all([
      base44.asServiceRole.entities.Customer.list(),
      base44.asServiceRole.entities.PickupRequest.list(),
      base44.asServiceRole.entities.Payment.list(),
      base44.asServiceRole.entities.Notification.list(),
    ]);

    const usage = {}; // tenant_id -> metrics
    const ensure = (tid) => {
      if (!tid) return null;
      if (!usage[tid]) usage[tid] = { customers_count: 0, pickups_count: 0, payments_count: 0, payments_ugx: 0, sms_count: 0 };
      return usage[tid];
    };

    // Customers active in period = created in/before period and not deleted (count all current)
    for (const c of customers) {
      const u = ensure(c.tenant_id);
      if (u) u.customers_count++;
    }
    for (const p of pickups) {
      if (!inPeriod(p.created_date)) continue;
      const u = ensure(p.tenant_id);
      if (u) u.pickups_count++;
    }
    for (const pay of payments) {
      if (!inPeriod(pay.payment_date || pay.created_date)) continue;
      if (pay.status !== 'completed') continue;
      const u = ensure(pay.tenant_id);
      if (u) { u.payments_count++; u.payments_ugx += pay.amount_ugx || 0; }
    }
    for (const n of notifications) {
      if (n.channel !== 'sms') continue;
      if (!inPeriod(n.sent_at || n.created_date)) continue;
      const u = ensure(n.tenant_id);
      if (u) u.sms_count++;
    }

    // Upsert TenantUsage rows
    let upserts = 0;
    for (const [tenant_id, metrics] of Object.entries(usage)) {
      const existing = await base44.asServiceRole.entities.TenantUsage.filter({ tenant_id, period });
      const payload = { tenant_id, period, ...metrics, computed_at: now.toISOString() };
      if (existing?.length) {
        await base44.asServiceRole.entities.TenantUsage.update(existing[0].id, payload);
      } else {
        await base44.asServiceRole.entities.TenantUsage.create(payload);
      }
      upserts++;
    }

    return Response.json({ success: true, period, tenants: upserts, usage });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
