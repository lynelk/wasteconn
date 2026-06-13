import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Emails the latest generated compliance report (PDF link) to each tenant's
// contact email. Marks reports as submitted and logs an audit entry.
// Auth: admin/super_admin user OR scheduled call (body._scheduled).

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    if (!body._scheduled) {
      const user = await base44.auth.me().catch(() => null);
      if (!user || !['admin', 'super_admin'].includes(user.role)) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Reports that are generated and have a PDF but haven't been submitted yet
    const reports = await base44.asServiceRole.entities.ComplianceReport.filter({ status: 'generated' });
    const sendable = reports.filter(r => r.pdf_url);

    if (sendable.length === 0) {
      return Response.json({ success: true, sent: 0, message: 'No generated reports with a PDF to send.' });
    }

    const tenants = await base44.asServiceRole.entities.Tenant.list();
    const tenantById = Object.fromEntries(tenants.map(t => [t.id, t]));

    let sent = 0;
    const skipped = [];

    for (const report of sendable) {
      const tenant = tenantById[report.tenant_id];
      const to = tenant?.contact_email;
      if (!to) { skipped.push({ report_id: report.id, reason: 'No tenant contact email' }); continue; }

      const subject = `NLSWMS Compliance Report — ${report.report_type} (${report.period_from} to ${report.period_to})`;
      const reportBody = `Dear ${tenant.name || 'Partner'},\n\n`
        + `Your ${report.report_type.replace(/_/g, ' ')} compliance report for the period `
        + `${report.period_from} to ${report.period_to} is ready.\n\n`
        + `Download it here: ${report.pdf_url}\n\n`
        + `This is an automated message from the NLSWMS platform.`;

      await base44.asServiceRole.integrations.Core.SendEmail({ to, subject, body: reportBody });

      await base44.asServiceRole.entities.ComplianceReport.update(report.id, {
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        submitted_to: to,
      });

      try {
        await base44.asServiceRole.entities.AuditLog.create({
          tenant_id: report.tenant_id,
          event_type: 'bulk_export',
          entity_type: 'ComplianceReport',
          entity_id: report.id,
          risk_score: 0,
          notes: `Compliance report emailed to ${to}`,
        });
      } catch { /* audit non-blocking */ }

      sent++;
    }

    return Response.json({ success: true, sent, skipped });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
