import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Public / citizen reporting endpoint (no account required).
// Anyone can report illegal dumping, an overflowing or damaged bin, or a missed
// collection with an optional photo + geotag. We create a Complaint tagged
// source=public_report so it flows into the existing Complaints + Omni-Inbox
// triage pipeline. If the report references a known overflowing smart bin we
// also flag that bin so it surfaces for fill-driven collection.
//
// Payload: { tenant_id, category, description, reporter_name?, reporter_contact?,
//            latitude?, longitude?, photo_urls?, smart_bin_code?, address? }

const ALLOWED = new Set([
  'illegal_dumping',
  'overflowing_bin',
  'damaged_bin',
  'missed_collection',
  'service_quality',
  'other',
]);

// Map public-report categories onto the Ticket entity's category enum.
const TICKET_CATEGORY: Record<string, string> = {
  missed_collection: 'missed_collection',
  service_quality: 'service_quality',
  damaged_bin: 'bin_damage',
  overflowing_bin: 'service_quality',
  illegal_dumping: 'other',
  other: 'other',
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const tenantId = body.tenant_id || Deno.env.get('DEFAULT_TENANT_ID');
    if (!tenantId) return Response.json({ error: 'tenant_id required' }, { status: 400 });
    if (!body.description || String(body.description).trim().length < 5) {
      return Response.json({ error: 'A short description is required' }, { status: 400 });
    }

    const category = ALLOWED.has(body.category) ? body.category : 'other';

    // Link a referenced container (scoped to the report's tenant) for operator
    // context only. We deliberately do NOT mutate the container's sensor state
    // here — an unauthenticated citizen report must not directly create
    // operational collection work; an operator confirms it first.
    let smartBinId: string | undefined;
    if (body.smart_bin_code) {
      const containers = await base44.asServiceRole.entities.Container.filter({ tenant_id: tenantId, qr_code: body.smart_bin_code });
      if (containers?.[0]) smartBinId = containers[0].id;
    }

    const priority = category === 'illegal_dumping' || category === 'overflowing_bin' ? 'high' : 'medium';

    const complaint = await base44.asServiceRole.entities.Complaint.create({
      tenant_id: tenantId,
      category,
      source: 'public_report',
      subject: body.subject || `Public report: ${category.replace(/_/g, ' ')}`,
      description: String(body.description).trim(),
      status: 'open',
      priority,
      reporter_name: body.reporter_name || 'Anonymous',
      reporter_contact: body.reporter_contact || '',
      latitude: typeof body.latitude === 'number' ? body.latitude : undefined,
      longitude: typeof body.longitude === 'number' ? body.longitude : undefined,
      photo_urls: Array.isArray(body.photo_urls) ? body.photo_urls : [],
      smart_bin_id: smartBinId,
    });

    // Also raise a Ticket so the report enters the Omni-Inbox triage flow
    // (which lists Ticket records, not Complaints).
    const reporter = body.reporter_contact || '';
    const isEmail = reporter.includes('@');
    await base44.asServiceRole.entities.Ticket.create({
      tenant_id: tenantId,
      source: 'web_form',
      category: TICKET_CATEGORY[category] || 'other',
      priority,
      subject: body.subject || `Public report: ${category.replace(/_/g, ' ')}`,
      description: String(body.description).trim(),
      status: 'open',
      customer_name: body.reporter_name || 'Anonymous (public report)',
      customer_phone: isEmail ? undefined : (reporter || undefined),
      customer_email: isEmail ? reporter : undefined,
      tags: ['public_report'],
      notes: [
        `Public report (Complaint ${complaint.id}).`,
        typeof body.latitude === 'number' ? `Location: ${body.latitude}, ${body.longitude}` : null,
        smartBinId ? `Bin: ${smartBinId}` : null,
      ].filter(Boolean).join(' '),
    }).catch(() => null);

    return Response.json({
      success: true,
      report_id: complaint.id,
      reference: complaint.id.slice(0, 8).toUpperCase(),
      message: 'Thank you. Your report has been submitted and will be reviewed by the operations team.',
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
