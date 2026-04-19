import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { jsPDF } from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { customer_id, date_from, date_to } = await req.json();
    if (!customer_id) return Response.json({ error: 'customer_id required' }, { status: 400 });

    // Fetch customer, payments and invoices in parallel
    const [customers, payments, invoices] = await Promise.all([
      base44.asServiceRole.entities.Customer.filter({ id: customer_id }),
      base44.asServiceRole.entities.Payment.filter({ customer_id }),
      base44.asServiceRole.entities.Invoice.filter({ customer_id }),
    ]);

    const customer = customers?.[0];
    if (!customer) return Response.json({ error: 'Customer not found' }, { status: 404 });

    // Filter by date range
    const from = date_from ? new Date(date_from) : new Date('2000-01-01');
    const to = date_to ? new Date(date_to) : new Date();

    const filteredPayments = payments.filter(p => {
      if (!p.payment_date) return false;
      const d = new Date(p.payment_date);
      return d >= from && d <= to;
    });

    const filteredInvoices = invoices.filter(i => {
      if (!i.issue_date) return false;
      const d = new Date(i.issue_date);
      return d >= from && d <= to;
    });

    // Calculate totals
    const totalPaid = filteredPayments.filter(p => p.status === 'completed').reduce((s, p) => s + (p.amount_ugx || 0), 0);
    const totalInvoiced = filteredInvoices.reduce((s, i) => s + (i.amount_ugx || 0), 0);
    const outstanding = filteredInvoices
      .filter(i => ['issued', 'overdue', 'partially_paid'].includes(i.status))
      .reduce((s, i) => s + (i.amount_ugx || 0), 0);

    // Build PDF
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = 210;
    const margin = 18;
    let y = 20;

    // Header band
    doc.setFillColor(34, 197, 94);
    doc.rect(0, 0, pageW, 14, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('NLSWMS — Customer Account Statement', margin, 9.5);

    // Date
    doc.setTextColor(200, 255, 200);
    doc.setFontSize(8);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-UG', { dateStyle: 'long' })}`, pageW - margin, 9.5, { align: 'right' });

    y = 26;
    doc.setTextColor(30, 30, 30);

    // Customer info block
    doc.setFillColor(245, 250, 245);
    doc.roundedRect(margin, y, pageW - margin * 2, 26, 2, 2, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(customer.full_name, margin + 4, y + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    const info = [
      customer.account_number ? `Account: ${customer.account_number}` : null,
      customer.phone,
      customer.email,
      customer.address,
      customer.district,
    ].filter(Boolean).join('   ·   ');
    doc.text(info, margin + 4, y + 15);
    doc.setFontSize(8.5);
    doc.text(`Statement Period: ${date_from || 'All time'} — ${date_to || new Date().toISOString().slice(0,10)}`, margin + 4, y + 22);
    y += 32;

    // Summary boxes
    doc.setTextColor(30, 30, 30);
    const boxes = [
      { label: 'Total Invoiced', value: `${totalInvoiced.toLocaleString()} UGX`, color: [59, 130, 246] },
      { label: 'Total Paid', value: `${totalPaid.toLocaleString()} UGX`, color: [34, 197, 94] },
      { label: 'Outstanding Balance', value: `${outstanding.toLocaleString()} UGX`, color: outstanding > 0 ? [239, 68, 68] : [34, 197, 94] },
    ];
    const boxW = (pageW - margin * 2 - 8) / 3;
    boxes.forEach((b, i) => {
      const bx = margin + i * (boxW + 4);
      doc.setFillColor(...b.color);
      doc.roundedRect(bx, y, boxW, 16, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.text(b.label, bx + boxW / 2, y + 5.5, { align: 'center' });
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.text(b.value, bx + boxW / 2, y + 12, { align: 'center' });
    });
    y += 22;

    // Payments table
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Payment History', margin, y);
    y += 5;

    // Table header
    doc.setFillColor(220, 240, 220);
    doc.rect(margin, y, pageW - margin * 2, 7, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 80, 40);
    const cols = [margin + 2, margin + 28, margin + 60, margin + 105, margin + 138];
    doc.text('Date', cols[0], y + 5);
    doc.text('Method', cols[1], y + 5);
    doc.text('Ref', cols[2], y + 5);
    doc.text('Status', cols[3], y + 5);
    doc.text('Amount (UGX)', pageW - margin - 2, y + 5, { align: 'right' });
    y += 9;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 40);
    const methodLabel = { mtn_momo: 'MTN MoMo', airtel_money: 'Airtel', cash: 'Cash', bank_transfer: 'Bank', yo_payments: 'Yo!' };

    filteredPayments.sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date)).forEach((p, idx) => {
      if (y > 265) { doc.addPage(); y = 20; }
      if (idx % 2 === 0) { doc.setFillColor(250, 253, 250); doc.rect(margin, y - 1, pageW - margin * 2, 7, 'F'); }
      doc.setFontSize(8);
      doc.text(p.payment_date || '—', cols[0], y + 4.5);
      doc.text(methodLabel[p.payment_method] || p.payment_method || '—', cols[1], y + 4.5);
      doc.text((p.transaction_ref || '—').slice(0, 20), cols[2], y + 4.5);
      doc.text(p.status || '—', cols[3], y + 4.5);
      doc.text((p.amount_ugx || 0).toLocaleString(), pageW - margin - 2, y + 4.5, { align: 'right' });
      y += 7;
    });

    if (filteredPayments.length === 0) {
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(8.5);
      doc.text('No payments recorded in this period.', margin + 4, y + 4);
      y += 10;
    }

    // Invoices table
    y += 6;
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Invoices', margin, y);
    y += 5;

    doc.setFillColor(220, 230, 255);
    doc.rect(margin, y, pageW - margin * 2, 7, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 100);
    doc.text('Invoice #', margin + 2, y + 5);
    doc.text('Issue Date', cols[1], y + 5);
    doc.text('Due Date', cols[2], y + 5);
    doc.text('Status', cols[3], y + 5);
    doc.text('Amount (UGX)', pageW - margin - 2, y + 5, { align: 'right' });
    y += 9;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 40);
    filteredInvoices.sort((a, b) => new Date(b.issue_date) - new Date(a.issue_date)).forEach((inv, idx) => {
      if (y > 265) { doc.addPage(); y = 20; }
      if (idx % 2 === 0) { doc.setFillColor(248, 248, 255); doc.rect(margin, y - 1, pageW - margin * 2, 7, 'F'); }
      doc.setFontSize(8);
      doc.text(inv.invoice_number || '—', margin + 2, y + 4.5);
      doc.text(inv.issue_date || '—', cols[1], y + 4.5);
      doc.text(inv.due_date || '—', cols[2], y + 4.5);
      doc.text(inv.status || '—', cols[3], y + 4.5);
      doc.text((inv.amount_ugx || 0).toLocaleString(), pageW - margin - 2, y + 4.5, { align: 'right' });
      y += 7;
    });

    if (filteredInvoices.length === 0) {
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(8.5);
      doc.text('No invoices in this period.', margin + 4, y + 4);
      y += 10;
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${i} of ${pageCount}  ·  NLSWMS Account Statement`, pageW / 2, 292, { align: 'center' });
    }

    const pdfBytes = doc.output('arraybuffer');
    const filename = `statement_${customer.full_name.replace(/\s+/g, '_')}_${date_from || 'all'}_${date_to || 'today'}.pdf`;

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});