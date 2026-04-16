import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { jsPDF } from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // This is called by scheduled automation — use service role
    const now = new Date();
    // Default to previous month
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const periodFrom = prevMonth.toISOString().substring(0, 10);
    const periodTo = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().substring(0, 10);

    // Fetch completed jobs in period
    const allJobs = await base44.asServiceRole.entities.PickupRequest.list();
    const jobs = allJobs.filter(j => {
      const d = j.completed_at ? j.completed_at.substring(0, 10) : j.scheduled_date;
      return d >= periodFrom && d <= periodTo && j.status === 'completed';
    });

    // Fetch payments in period
    const allPayments = await base44.asServiceRole.entities.Payment.list();
    const payments = allPayments.filter(p => p.payment_date >= periodFrom && p.payment_date <= periodTo);

    // Fetch completed routes in period
    const allRoutes = await base44.asServiceRole.entities.Route.list();
    const routes = allRoutes.filter(r => r.route_date >= periodFrom && r.route_date <= periodTo && r.status === 'completed');

    const evidenceCount = jobs.reduce((acc, j) => acc + (j.photo_urls?.length || 0), 0);
    const totalWeight = jobs.reduce((acc, j) => acc + (j.actual_weight_kg || 0), 0);
    const totalRevenue = payments.filter(p => p.status === 'completed').reduce((a, p) => a + (p.amount_ugx || 0), 0);

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = 210;
    const margin = 18;
    let y = margin;
    const reportNum = `RPT-MONTHLY-${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;

    // Header
    doc.setFillColor(34, 139, 80);
    doc.rect(0, 0, pageW, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('NLSWMS — Monthly Compliance Report', margin, 12);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toISOString()} UTC  |  Automated Monthly Archive`, margin, 21);

    y = 36;
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Report Details', margin, y); y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const meta = [
      ['Report Number', reportNum],
      ['Report Type', 'monthly_summary'],
      ['Period', `${periodFrom} to ${periodTo}`],
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
    doc.setFillColor(240, 248, 244);
    doc.roundedRect(margin, y, pageW - margin * 2, 34, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(34, 139, 80);
    doc.text('Monthly Summary Statistics', margin + 4, y + 7);
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Jobs Completed: ${jobs.length}`, margin + 4, y + 14);
    doc.text(`Routes Completed: ${routes.length}`, margin + 75, y + 14);
    doc.text(`Evidence Photos: ${evidenceCount}`, margin + 4, y + 21);
    doc.text(`Total Weight (kg): ${totalWeight.toFixed(2)}`, margin + 75, y + 21);
    doc.text(`Revenue (UGX): ${totalRevenue.toLocaleString()}`, margin + 4, y + 28);
    doc.text(`Payments Recorded: ${payments.length}`, margin + 75, y + 28);
    y += 40;

    // Jobs table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Completed Jobs', margin, y); y += 5;
    doc.setFillColor(34, 139, 80);
    doc.rect(margin, y, pageW - margin * 2, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7.5);
    doc.text('Job ID', margin + 1, y + 4);
    doc.text('Address', margin + 22, y + 4);
    doc.text('Waste Type', margin + 85, y + 4);
    doc.text('Weight(kg)', margin + 120, y + 4);
    doc.text('Photos', margin + 148, y + 4);
    doc.text('Completed', margin + 163, y + 4);
    y += 6;
    doc.setTextColor(30, 30, 30);
    jobs.forEach((job, idx) => {
      if (y > 270) { doc.addPage(); y = margin; }
      const bg = idx % 2 === 0 ? [255, 255, 255] : [245, 250, 247];
      doc.setFillColor(...bg);
      doc.rect(margin, y, pageW - margin * 2, 5.5, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(job.id.slice(0, 8), margin + 1, y + 3.5);
      doc.text((job.address || '—').substring(0, 35), margin + 22, y + 3.5);
      doc.text(job.waste_type || '—', margin + 85, y + 3.5);
      doc.text(String(job.actual_weight_kg || '—'), margin + 120, y + 3.5);
      doc.text(String(job.photo_urls?.length || 0), margin + 148, y + 3.5);
      doc.text(job.completed_at ? job.completed_at.substring(0, 10) : '—', margin + 163, y + 3.5);
      y += 5.5;
    });

    if (jobs.length === 0) {
      doc.setFontSize(8); doc.setTextColor(150, 150, 150);
      doc.text('No completed jobs in this period.', margin + 4, y + 5); y += 10;
    }

    // Payments
    if (payments.length > 0) {
      y += 6;
      if (y > 250) { doc.addPage(); y = margin; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(30, 30, 30);
      doc.text('Payment Records', margin, y); y += 5;
      doc.setFillColor(34, 139, 80);
      doc.rect(margin, y, pageW - margin * 2, 6, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(7.5);
      doc.text('Payment ID', margin + 1, y + 4);
      doc.text('Date', margin + 35, y + 4);
      doc.text('Method', margin + 65, y + 4);
      doc.text('Amount (UGX)', margin + 100, y + 4);
      doc.text('Status', margin + 145, y + 4);
      y += 6;
      doc.setTextColor(30, 30, 30);
      payments.forEach((p, idx) => {
        if (y > 270) { doc.addPage(); y = margin; }
        const bg = idx % 2 === 0 ? [255, 255, 255] : [245, 250, 247];
        doc.setFillColor(...bg);
        doc.rect(margin, y, pageW - margin * 2, 5.5, 'F');
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
        doc.text(p.id.slice(0, 8), margin + 1, y + 3.5);
        doc.text(p.payment_date || '—', margin + 35, y + 3.5);
        doc.text(p.payment_method || '—', margin + 65, y + 3.5);
        doc.text((p.amount_ugx || 0).toLocaleString(), margin + 100, y + 3.5);
        doc.text(p.status || '—', margin + 145, y + 3.5);
        y += 5.5;
      });
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFillColor(34, 139, 80);
      doc.rect(0, 287, pageW, 10, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(7);
      doc.text(`NLSWMS Compliance Report | ${reportNum} | Page ${i} of ${pageCount} | IMMUTABLE ARCHIVE`, margin, 293);
    }

    const pdfBase64 = doc.output('datauristring');
    // Store as data URI reference (in production, integrate with storage)
    const pdfUrl = pdfBase64.length > 0 ? `data:application/pdf;base64,${doc.output('base64')}` : null;
    // Attempt cloud upload
    let cloudUrl = null;
    try {
      const pdfBytes = doc.output('arraybuffer');
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const uploadRes = await base44.asServiceRole.integrations.Core.UploadFile({ file: blob });
      cloudUrl = uploadRes?.file_url || null;
    } catch (_) {}

    await base44.asServiceRole.entities.ComplianceReport.create({
      tenant_id: 'system',
      report_number: reportNum,
      report_type: 'monthly_summary',
      period_from: periodFrom,
      period_to: periodTo,
      status: 'generated',
      pdf_url: cloudUrl || null,
      jobs_count: jobs.length,
      evidence_photos_count: evidenceCount,
      total_weight_kg: totalWeight,
      total_revenue_ugx: totalRevenue,
      generated_by: 'system_scheduler',
    });

    return Response.json({ success: true, report_number: reportNum, pdf_url: cloudUrl, jobs_count: jobs.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});