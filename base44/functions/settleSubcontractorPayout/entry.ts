import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['admin', 'super_admin'].includes(user.role)) {
      return Response.json({ error: 'Forbidden: Admin role required' }, { status: 403 });
    }

    const { job_ids, payment_method } = await req.json();

    if (!Array.isArray(job_ids) || job_ids.length === 0) {
      return Response.json({ error: 'job_ids[] is required' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const settledJobs = [];
    let totalPayout = 0;
    let firstTenantId = null;
    let firstSubcontractorId = null;

    for (const job_id of job_ids) {
      const job = await base44.asServiceRole.entities.SubcontractorJob.get(job_id);
      if (!job) continue;
      if (job.payout_status === 'paid') continue;

      await base44.asServiceRole.entities.SubcontractorJob.update(job_id, {
        payout_status: 'paid',
      });

      settledJobs.push(job_id);
      totalPayout += job.payout_ugx || 0;
      if (!firstTenantId) firstTenantId = job.tenant_id;
      if (!firstSubcontractorId) firstSubcontractorId = job.subcontractor_id;
    }

    if (settledJobs.length === 0) {
      return Response.json({ error: 'No eligible jobs to settle' }, { status: 400 });
    }

    // Create an Invoice record for audit
    const invoice = await base44.asServiceRole.entities.Invoice.create({
      tenant_id: firstTenantId,
      customer_id: firstSubcontractorId,
      amount: totalPayout,
      currency: 'UGX',
      status: 'paid',
      description: `Subcontractor payout for ${settledJobs.length} job(s) via ${payment_method || 'manual'}`,
      issued_at: now,
      paid_at: now,
      line_items: JSON.stringify(settledJobs.map(id => ({ job_id: id }))),
    }).catch(() => null);

    return Response.json({
      success: true,
      settled_job_count: settledJobs.length,
      total_payout_ugx: totalPayout,
      invoice_id: invoice?.id || null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});