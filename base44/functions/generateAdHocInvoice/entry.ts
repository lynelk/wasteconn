import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Ad-hoc Invoice Generator
// Creates a single invoice for a customer outside the regular billing cycle
// Supports custom line items, period override, and immediate dispatch

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const {
      customer_id,
      tenant_id,
      line_items,         // [{ description, amount_ugx, quantity }]
      period_from,
      period_to,
      due_days = 14,
      notes,
      send_notification = true,
    } = body;

    if (!customer_id) return Response.json({ error: 'customer_id required' }, { status: 400 });
    if (!line_items?.length) return Response.json({ error: 'line_items required' }, { status: 400 });

    const customerArr = await base44.asServiceRole.entities.Customer.filter({ id: customer_id });
    const customer = customerArr?.[0];
    if (!customer) return Response.json({ error: 'Customer not found' }, { status: 404 });

    const total = line_items.reduce((sum, item) => sum + (item.amount_ugx * (item.quantity || 1)), 0);
    const today = new Date().toISOString().split('T')[0];
    const dueDate = new Date(Date.now() + due_days * 86400000).toISOString().split('T')[0];

    // Generate invoice number
    const invoiceCount = await base44.asServiceRole.entities.Invoice.list('-created_date', 1);
    const seq = (invoiceCount.length > 0 ? parseInt(invoiceCount[0].invoice_number?.replace(/\D/g, '') || '0') + 1 : 1000);
    const invoiceNumber = `INV-ADHOC-${seq}`;

    const invoice = await base44.asServiceRole.entities.Invoice.create({
      tenant_id: tenant_id || customer.tenant_id,
      customer_id,
      invoice_number: invoiceNumber,
      invoice_type: 'ad_hoc',
      period_from: period_from || today,
      period_to: period_to || today,
      amount_ugx: total,
      status: 'issued',
      due_date: dueDate,
      issued_at: new Date().toISOString(),
      issued_by: user.email,
      line_items: JSON.stringify(line_items),
      notes: notes || 'Ad-hoc invoice',
    });

    // Optionally queue notification
    if (send_notification && (customer.email || customer.phone)) {
      await base44.asServiceRole.entities.Notification.create({
        tenant_id: tenant_id || customer.tenant_id,
        customer_id,
        recipient_email: customer.email || '',
        recipient_phone: customer.phone || '',
        channel: customer.email ? 'email' : 'sms',
        template_type: 'invoice_issued',
        subject: `Invoice ${invoiceNumber} — ${total.toLocaleString()} UGX due ${dueDate}`,
        body: `Dear ${customer.full_name}, your invoice ${invoiceNumber} for ${total.toLocaleString()} UGX is due on ${dueDate}. Please contact us for payment options.`,
        status: 'pending',
        related_entity_type: 'Invoice',
        related_entity_id: invoice.id,
      });
    }

    return Response.json({
      success: true,
      invoice_id: invoice.id,
      invoice_number: invoiceNumber,
      amount_ugx: total,
      due_date: dueDate,
      notification_queued: send_notification,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});