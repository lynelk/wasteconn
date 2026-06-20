import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { job_id, completion_evidence_url, gps_lat, gps_lng } = await req.json();

    if (!job_id) return Response.json({ error: 'job_id is required' }, { status: 400 });

    const job = await base44.asServiceRole.entities.SubcontractorJob.get(job_id);
    if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });

    if (job.status === 'completed') {
      return Response.json({ error: 'Job already completed' }, { status: 409 });
    }

    const now = new Date().toISOString();
    const updatedJob = await base44.asServiceRole.entities.SubcontractorJob.update(job_id, {
      status: 'completed',
      completed_at: now,
      completion_evidence_url: completion_evidence_url || job.completion_evidence_url,
      gps_lat: gps_lat || job.gps_lat,
      gps_lng: gps_lng || job.gps_lng,
    });

    // Compute SLA compliance — check if completed within grace period
    let isLate = false;
    if (job.allocated_at && job.grace_period_days) {
      const allocatedMs = new Date(job.allocated_at).getTime();
      const gracePeriodMs = job.grace_period_days * 24 * 60 * 60 * 1000;
      const completedMs = new Date(now).getTime();
      isLate = completedMs > allocatedMs + gracePeriodMs;
    }

    // If late, auto-flag as disputed
    if (isLate) {
      await base44.asServiceRole.entities.SubcontractorJob.update(job_id, {
        status: 'disputed',
        dispute_notes: `Auto-flagged: Completed after grace period of ${job.grace_period_days} day(s). Requires dispatcher review.`,
      });
    }

    // Notify dispatcher
    await base44.asServiceRole.entities.Notification.create({
      tenant_id: job.tenant_id,
      type: 'subcontractor_job_completed',
      title: isLate ? 'Subcontractor Job Completed Late' : 'Subcontractor Job Completed',
      message: isLate
        ? `Job ${job_id} was completed after the ${job.grace_period_days}-day grace period. Review required.`
        : `Job ${job_id} has been marked as completed by the subcontractor.`,
      entity_type: 'SubcontractorJob',
      entity_id: job_id,
      is_read: false,
      created_at: now,
    }).catch(() => {});

    return Response.json({ success: true, job: updatedJob, sla_breached: isLate });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});