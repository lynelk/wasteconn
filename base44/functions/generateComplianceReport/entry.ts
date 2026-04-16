import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { jsPDF } from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { route_id, period_from, period_to, report_type } = await req.json();

    // Fetch route data
    let route = null;
    let jobs = [];
    let payments = [];

    if (route_id) {
      const routes = await base44.asServiceRole.entities.Route.filter({ id: route_id });
      route = routes[0] || null;
      if (route?.job_ids?.length) {
        const allJobs = await base44.asServiceRole.entities.PickupRequest.list();
        jobs = allJobs.filter(j => route.job_ids.includes(j.id));
      }
    } else if (period_from && period_to) {
      const allJobs = await base44.asServiceRole.entities.PickupRequest.list();
      jobs = allJobs.filter(j => {
        const d = j.completed_at ? j.completed_at.substring(0, 10) : j.scheduled_date;
        return d >= period_from && d <= period_to && j.status === 'completed';
      });
      const allPayments = await base44.asServiceRole.entities.Payment.list();
      payments = allPayments.filter(p => {
        return p.payment_date >= period_from && p.payment_date <= period_to;
      });
    }

    // Evidence photos count
    const evidenceCount = jobs.reduce((acc, j) => acc + (j.photo_urls?.length || 0), 0);
    const totalWeight = jobs.reduce((acc, j) => acc + (j.actual_weight_kg || 0), 0);
    const completedJobs = jobs.filter(j => j.status === 'completed');

    // Build PDF
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = 210;
    const margin = 18;
    let y = margin;

    // Header bar
    doc.setFillColor(34, 139, 80);
    doc.rect(0, 0, pageW, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('NLSWMS — Municipal Compliance Report', margin, 12);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toISOString()} UTC  |  By: ${user.full_name || user.email}`, margin, 21);

    y = 36;
    doc.setTextColor(30, 30, 30);

    // Report meta
    const reportNum = `RPT-${Date.now()}`;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Report Details', margin, y); y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const meta = [
      ['Report Number', reportNum],
      ['Report Type', report_type || 'route_completion'],
      ['Period', `${period_from || route?.route_date || '—'} to ${period_to || route?.route_date || '—'}`],
      ['Route ID', route_id || 'N/A (Period Report)'],
      ['Route Name', route?.route_name || '—'],
      ['Route Status', route?.status || '—'],
      ['Generated At', new Date().toISOString()],
    ];
    meta.forEach(([k, v]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(`${k}:`, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.text(String(v), margin + 45, y);
      y += 5;
    });

    y += 4;
    // Summary stats
    doc.setFillColor(240, 248, 244);
    doc.roundedRect(margin, y, pageW - margin * 2, 28, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(34, 139, 80);
    doc.text('Summary Statistics', margin + 4, y + 7);
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Jobs: ${jobs.length}`, margin + 4, y + 14);
    doc.text(`Completed: ${completedJobs.length}`, margin + 45, y + 14);
    doc.text(`Evidence Photos: ${evidenceCount}`, margin + 90, y + 14);
    doc.text(`Total Weight: ${totalWeight.toFixed(2)} kg`, margin + 4, y + 21);
    if (payments.length > 0) {
      const totalRev = payments.filter(p => p.status === 'completed').reduce((a, p) => a + (p.amount_ugx || 0), 0);
      doc.text(`Revenue (UGX): ${totalRev.toLocaleString()}`, margin + 45, y + 21);
    }
    y += 34;

    // Jobs table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Completed Jobs / Evidence', margin, y); y += 5;

    // Table header
    doc.setFillColor(34, 139, 80);
    doc.rect(margin, y, pageW - margin * 2, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7.5);
    doc.text('Job ID', margin + 1, y + 4);
    doc.text('Address', margin + 22, y + 4);
    doc.text('Type', margin + 85, y + 4);
    doc.text('Status', margin + 105, y + 4);
    doc.text('Weight(kg)', margin + 125, y + 4);
    doc.text('Photos', margin + 148, y + 4);
    doc.text('Completed', margin + 163, y + 4);
    y += 6;

    doc.setTextColor(30, 30, 30);
    jobs.forEach((job, idx) => {
      if (y > 270) {
        doc.addPage();
        y = margin;
      }
      const bg = idx % 2 === 0 ? [255, 255, 255] : [245, 250, 247];
      doc.setFillColor(...bg);
      doc.rect(margin, y, pageW - margin * 2, 5.5, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(job.id.slice(0, 8), margin + 1, y + 3.5);
      doc.text((job.address || '—').substring(0, 35), margin + 22, y + 3.5);
      doc.text(job.waste_type || '—', margin + 85, y + 3.5);
      doc.text(job.status || '—', margin + 105, y + 3.5);
      doc.text(String(job.actual_weight_kg || '—'), margin + 125, y + 3.5);
      doc.text(String(job.photo_urls?.length || 0), margin + 148, y + 3.5);
      doc.text(job.completed_at ? job.completed_at.substring(0, 10) : '—', margin + 163, y + 3.5);
      y += 5.5;
    });

    if (jobs.length === 0) {
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('No jobs found for the selected period.', margin + 4, y + 5);
      y += 10;
    }

    // Payments section (period reports)
    if (payments.length > 0) {
      y += 6;
      if (y > 250) { doc.addPage(); y = margin; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 30, 30);
      doc.text('Payment Records', margin, y); y += 5;

      doc.setFillColor(34, 139, 80);
      doc.rect(margin, y, pageW - margin * 2, 6, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7.5);
      doc.text('Payment ID', margin + 1, y + 4);
      doc.text('Date', margin + 30, y + 4);
      doc.text('Method', margin + 60, y + 4);
      doc.text('Amount (UGX)', margin + 95, y + 4);
      doc.text('Status', margin + 140, y + 4);
      y += 6;

      doc.setTextColor(30, 30, 30);
      payments.forEach((p, idx) => {
        if (y > 270) { doc.addPage(); y = margin; }
        const bg = idx % 2 === 0 ? [255, 255, 255] : [245, 250, 247];
        doc.setFillColor(...bg);
        doc.rect(margin, y, pageW - margin * 2, 5.5, 'F');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text(p.id.slice(0, 8), margin + 1, y + 3.5);
        doc.text(p.payment_date || '—', margin + 30, y + 3.5);
        doc.text(p.payment_method || '—', margin + 60, y + 3.5);
        doc.text((p.amount_ugx || 0).toLocaleString(), margin + 95, y + 3.5);
        doc.text(p.status || '—', margin + 140, y + 3.5);
        y += 5.5;
      });
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFillColor(34, 139, 80);
      doc.rect(0, 287, pageW, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.text(`NLSWMS Compliance Report | ${reportNum} | Page ${i} of ${pageCount} | IMMUTABLE ARCHIVE`, margin, 293);
    }

    const pdfBytes = doc.output('arraybuffer');

    // Upload to storage
    const formData = new FormData();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    formData.append('file', blob, `compliance_${reportNum}.pdf`);

    const uploadRes = await base44.asServiceRole.integrations.Core.UploadFile({ file: blob });
    const pdfUrl = uploadRes?.file_url || null;

    // Store the report record
    const report = await base44.asServiceRole.entities.ComplianceReport.create({
      tenant_id: user.email,
      report_number: reportNum,
      report_type: report_type || 'route_completion',
      route_id: route_id || null,
      period_from: period_from || route?.route_date || new Date().toISOString().substring(0, 10),
      period_to: period_to || route?.route_date || new Date().toISOString().substring(0, 10),
      status: 'generated',
      pdf_url: pdfUrl,
      jobs_count: jobs.length,
      evidence_photos_count: evidenceCount,
      total_weight_kg: totalWeight,
      generated_by: user.email,
    });

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="compliance_${reportNum}.pdf"`,
        'X-Report-Id': report.id,
        'X-Report-Number': reportNum,
        'X-Pdf-Url': pdfUrl || '',
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});