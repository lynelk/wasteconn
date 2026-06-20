import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['admin', 'super_admin'].includes(user.role)) {
      return Response.json({ error: 'Forbidden: Admin role required' }, { status: 403 });
    }

    const {
      facility_id, period, inbound_t,
      sorted_recyclable_t, sorted_organic_t, sorted_residue_t,
      recovered_energy_kwh, contamination_rate_pct
    } = await req.json();

    if (!facility_id || !period || !inbound_t) {
      return Response.json({ error: 'facility_id, period, and inbound_t are required' }, { status: 400 });
    }

    // Compute diversion rate
    const residue = sorted_residue_t || 0;
    const diversion_rate_pct = inbound_t > 0
      ? parseFloat(((1 - residue / inbound_t) * 100).toFixed(2))
      : 0;

    const tenantId = user.data?.tenant_id || 'default';

    // Upsert: try to find existing record for same facility + period
    const existing = await base44.asServiceRole.entities.FacilityYieldRecord.filter({
      facility_id,
      period,
      tenant_id: tenantId,
    });

    let record;
    const payload = {
      tenant_id: tenantId,
      facility_id,
      period,
      inbound_t,
      sorted_recyclable_t: sorted_recyclable_t || 0,
      sorted_organic_t: sorted_organic_t || 0,
      sorted_residue_t: residue,
      recovered_energy_kwh: recovered_energy_kwh || null,
      contamination_rate_pct: contamination_rate_pct || 0,
      diversion_rate_pct,
    };

    if (existing && existing.length > 0) {
      record = await base44.asServiceRole.entities.FacilityYieldRecord.update(existing[0].id, payload);
    } else {
      record = await base44.asServiceRole.entities.FacilityYieldRecord.create(payload);
    }

    return Response.json({ success: true, record, diversion_rate_pct });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});