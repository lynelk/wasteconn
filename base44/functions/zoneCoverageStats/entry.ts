import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// zoneCoverageStats — per-zone pickup coverage over a date range, for
// CoverageAnalytics. Replaces the in-browser PickupRequest/ExceptionQueue scans.
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
    if (!body.from || !body.to) {
      return Response.json({ error: 'from and to (YYYY-MM-DD) are required' }, { status: 400 });
    }
    const tenantId = user.role === 'super_admin' ? (body.tenant_id || null) : user.tenant_id;

    const pickWhere = { scheduled_date: { $gte: body.from, $lte: body.to } };
    if (tenantId) pickWhere.tenant_id = tenantId;
    if (body.zone_id) pickWhere.zone_id = body.zone_id;

    const excWhere = { exception_type: 'missed_pickup' };
    if (tenantId) excWhere.tenant_id = tenantId;

    const [pickups, exceptions] = await Promise.all([
      scan(base44.asServiceRole.entities.PickupRequest, pickWhere, ['zone_id', 'status', 'id']),
      scan(base44.asServiceRole.entities.ExceptionQueue, excWhere, ['pickup_request_id']),
    ]);

    const pickupIds = new Set(pickups.map((p) => p.id));
    const repeatMissByZone = {};
    const pickupZoneById = Object.fromEntries(pickups.map((p) => [p.id, p.zone_id || 'unzoned']));
    for (const e of exceptions) {
      if (!pickupIds.has(e.pickup_request_id)) continue;
      const z = pickupZoneById[e.pickup_request_id];
      repeatMissByZone[z] = (repeatMissByZone[z] || 0) + 1;
    }

    const byZone = {};
    for (const p of pickups) {
      const z = p.zone_id || 'unzoned';
      const s = (byZone[z] ||= { zone_id: z, scheduled: 0, completed: 0, missed: 0 });
      s.scheduled += 1;
      if (p.status === 'completed') s.completed += 1;
      if (p.status === 'missed') s.missed += 1;
    }

    const data = Object.values(byZone).map((s) => ({
      ...s,
      repeat_miss_exceptions: repeatMissByZone[s.zone_id] || 0,
      coverage_pct: s.scheduled ? Math.round((s.completed / s.scheduled) * 100) : 0,
    }));

    return Response.json({ success: true, data, generated_at: new Date().toISOString(), cached: false });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
