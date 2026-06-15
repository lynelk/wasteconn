import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Fill-driven (demand-based) collection planner.
// Selects smart bins that are at/above their collection threshold — or are
// predicted to cross it before the target date — and materialises a
// PickupRequest for each so the existing dispatch + aiRouteOptimiser pipeline
// can route them. This replaces fixed-calendar collection for monitored bins.
//
// Payload: { date?, zone_id?, threshold_override?, horizon_hours? }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !['admin', 'super_admin', 'dispatcher'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const date = body.date || new Date().toISOString().slice(0, 10);
    const zoneId = body.zone_id || null;
    const horizonHours = typeof body.horizon_hours === 'number' ? body.horizon_hours : 24;
    const horizonCutoff = Date.now() + horizonHours * 3_600_000;

    const bins = zoneId
      ? await base44.asServiceRole.entities.SmartBin.filter({ status: 'active', zone_id: zoneId })
      : await base44.asServiceRole.entities.SmartBin.filter({ status: 'active' });

    // Bins already queued by a previous run today (avoid duplicates).
    const pendingSmartBinJobs = await base44.asServiceRole.entities.PickupRequest.filter({
      tenant_id: user.tenant_id,
      status: 'pending',
      source: 'smart_bin',
      scheduled_date: date,
    });
    const alreadyQueuedBinCodes = new Set(
      pendingSmartBinJobs
        .map((j) => (typeof j.address === 'string' && j.address.startsWith('Bin ')) ? j.address.slice(4) : null)
        .filter(Boolean),
    );

    const due = bins.filter((b) => {
      if (b.bin_code && alreadyQueuedBinCodes.has(b.bin_code)) return false;
      const threshold = typeof body.threshold_override === 'number'
        ? body.threshold_override
        : (b.collection_threshold_pct || 80);
      const overThreshold = (b.fill_level_pct || 0) >= threshold;
      const predictedSoon = b.predicted_full_at && new Date(b.predicted_full_at).getTime() <= horizonCutoff;
      const alarmed = b.fire_alarm || b.fill_status === 'overflow';
      return overThreshold || predictedSoon || alarmed;
    });

    const created: string[] = [];
    for (const b of due) {
      const job = await base44.asServiceRole.entities.PickupRequest.create({
        tenant_id: b.tenant_id,
        customer_id: b.customer_id || 'municipal',
        zone_id: b.zone_id,
        service_point_id: b.service_point_id,
        request_type: 'scheduled',
        status: 'pending',
        scheduled_date: date,
        waste_type: b.waste_fraction === 'bio' ? 'organic'
          : b.waste_fraction === 'plastic' || b.waste_fraction === 'paper' || b.waste_fraction === 'glass' || b.waste_fraction === 'metal' ? 'recyclable'
          : b.waste_fraction === 'hazardous' ? 'hazardous'
          : 'general',
        address: b.bin_code ? `Bin ${b.bin_code}` : 'Smart bin',
        latitude: b.latitude,
        longitude: b.longitude,
        source: 'smart_bin',
        notes: `Auto-generated from smart bin ${b.bin_code} (${Math.round(b.fill_level_pct || 0)}% full${b.fill_status === 'overflow' ? ', OVERFLOW' : ''}${b.fire_alarm ? ', FIRE ALARM' : ''}).`,
      });
      created.push(job.id);
    }

    return Response.json({
      success: true,
      date,
      bins_evaluated: bins.length,
      jobs_created: created.length,
      job_ids: created,
      summary: created.length
        ? `Created ${created.length} fill-driven collection job(s) for ${date}. Run the route optimiser to assign vehicles.`
        : 'No bins are due for collection right now.',
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
