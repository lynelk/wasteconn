import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// archiveStaleRecords — moves old rows from high-growth tables into
// ArchivedRecord (cold) to keep hot tables small at scale. See LAUNCH_READINESS.
//
// SAFETY: dry_run defaults to TRUE — it reports what *would* be archived and
// deletes nothing unless explicitly invoked with { dry_run: false }. Intended to
// run as a scheduled job (body._scheduled) or by a super_admin.
//
// Default retention (days) per entity; override via body.retention_days.

const DEFAULT_RETENTION = {
  SensorReading: 180,
  VehicleTelematics: 180,
  AuditLog: 365,
  PickupRequest: 730,
};
const PAGE = 500;
const MAX_PER_RUN = 5000; // bound work per invocation

function cutoffISO(days) {
  return new Date(Date.now() - days * 86400000).toISOString();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    if (!body._scheduled) {
      const user = await base44.auth.me().catch(() => null);
      if (!user || user.role !== 'super_admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const dryRun = body.dry_run !== false; // default true
    const retention = { ...DEFAULT_RETENTION, ...(body.retention_days || {}) };
    const entities = body.entities || Object.keys(DEFAULT_RETENTION);
    const E = base44.asServiceRole.entities;

    const report = {};
    for (const name of entities) {
      const days = retention[name];
      if (!days || !E[name]) continue;
      const cutoff = cutoffISO(days);

      // Oldest-first page of records past the retention cutoff.
      const stale = await E[name].filter({ created_date: { $lt: cutoff } }, 'created_date', Math.min(PAGE, MAX_PER_RUN));
      report[name] = { cutoff, candidates: stale.length, archived: 0 };

      if (dryRun) continue;

      for (const rec of stale) {
        try {
          await E.ArchivedRecord.create({
            tenant_id: rec.tenant_id || null,
            source_entity: name,
            source_id: rec.id,
            original_created_date: rec.created_date,
            archived_at: new Date().toISOString(),
            payload: rec,
          });
          await E[name].delete(rec.id);
          report[name].archived += 1;
        } catch {
          // best-effort; skip rows that fail and continue
        }
      }
    }

    return Response.json({
      success: true,
      dry_run: dryRun,
      report,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
