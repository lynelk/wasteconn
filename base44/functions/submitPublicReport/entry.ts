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

    let smartBinId: string | undefined;
    if (body.smart_bin_code) {
      const bins = await base44.asServiceRole.entities.SmartBin.filter({ bin_code: body.smart_bin_code });
      if (bins?.[0]) {
        smartBinId = bins[0].id;
        if (category === 'overflowing_bin' && bins[0].fill_status !== 'overflow') {
          await base44.asServiceRole.entities.SmartBin.update(bins[0].id, { fill_status: 'overflow' });
        }
      }
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
