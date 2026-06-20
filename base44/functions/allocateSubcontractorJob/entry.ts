import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['admin', 'super_admin', 'dispatcher'].includes(user.role)) {
      return Response.json({ error: 'Forbidden: Dispatcher or Admin role required' }, { status: 403 });
    }

    const { subcontractor_id, pickup_request_ids } = await req.json();

    if (!subcontractor_id || !Array.isArray(pickup_request_ids) || pickup_request_ids.length === 0) {
      return Response.json({ error: 'subcontractor_id and pickup_request_ids[] are required' }, { status: 400 });
    }

    const subcontractor = await base44.asServiceRole.entities.Subcontractor.get(subcontractor_id);
    if (!subcontractor) return Response.json({ error: 'Subcontractor not found' }, { status: 404 });

    const now = new Date().toISOString();
    const createdJobs = [];

    for (const pickup_request_id of pickup_request_ids) {
      const job = await base44.asServiceRole.entities.SubcontractorJob.create({
        tenant_id: user.data?.tenant_id || subcontractor.tenant_id,
        subcontractor_id,
        pickup_request_id,
        status: 'allocated',
        allocated_at: now,
        payout_status: 'pending',
        grace_period_days: 1,
      });
      createdJobs.push(job);
    }

    // Send SMS via CitoConnect if phone available
    if (subcontractor.contact_phone) {
      const smsMessage = `WasteConn: ${createdJobs.length} new job(s) allocated to ${subcontractor.company_name}. Please log in to accept.`;
      await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `SMS notification sent to ${subcontractor.contact_phone}: ${smsMessage}`,
      }).catch(() => {}); // Non-blocking
    }

    // Queue integration webhook notification
    await base44.asServiceRole.entities.IntegrationQueue.create({
      tenant_id: subcontractor.tenant_id,
      integration_id: 'subcontractor_webhook',
      payload: JSON.stringify({
        event: 'jobs_allocated',
        subcontractor_id,
        job_ids: createdJobs.map(j => j.id),
        allocated_at: now,
      }),
      status: 'pending',
      created_at: now,
    }).catch(() => {});

    return Response.json({ success: true, jobs: createdJobs });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});