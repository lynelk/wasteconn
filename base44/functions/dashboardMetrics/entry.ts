import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// dashboardMetrics — server-side KPIs for the operations Dashboard.
// Replaces the whole-table Customer/PickupRequest/Payment/Complaint/Vehicle/
// Inventory/ServicePoint .list() scans previously done in the browser.
//
// Interim implementation: projection + paginated scan (only the columns needed
// cross the wire). At very high volume, migrate to maintained counters updated
// by the existing lifecycle hooks (onPickupCompleted, paymentWebhookHandler, …).
// See docs/AGGREGATION_SPECS.md.

const PAGE = 1000;
const SAFETY_CAP = 500_000;

// Paginated, projected scan of an entity. Returns minimal rows.
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
    const scope = (extra = {}) => (tenantId ? { tenant_id: tenantId, ...extra } : extra);
    const E = base44.asServiceRole.entities;

    const [customers, servicePoints, pendingPickups, openComplaints, completedPayments, availableVehicles, inventory] =
      await Promise.all([
        scan(E.Customer, scope(), ['id']),
        scan(E.ServicePoint, scope(), ['id']),
        scan(E.PickupRequest, scope({ status: 'pending' }), ['id']),
        scan(E.Complaint, scope({ status: 'open' }), ['id']),
        scan(E.Payment, scope({ status: 'completed' }), ['amount_ugx']),
        scan(E.Vehicle, scope({ status: 'available' }), ['id']),
        scan(E.Inventory, scope(), ['current_stock', 'safety_threshold']),
      ]);

    const data = {
      customers_total: customers.length,
      service_points_total: servicePoints.length,
      pickups_pending: pendingPickups.length,
      complaints_open: openComplaints.length,
      revenue_completed_ugx: completedPayments.reduce((s, p) => s + (p.amount_ugx || 0), 0),
      vehicles_available: availableVehicles.length,
      inventory_low_stock: inventory.filter((i) => (i.current_stock ?? 0) <= (i.safety_threshold ?? 0)).length,
    };

    return Response.json({ success: true, data, generated_at: new Date().toISOString(), cached: false });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
