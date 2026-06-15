import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Sends email notifications to customers whose invoices are OVERDUE.
// This function is created but the automation is OFF by default — enable it manually after testing.
//
// Duplicate-send protection: checks Notification entity for a record sent today
// for the same invoice before firing again.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !['admin', 'super_admin'].includes(user.role)) {
      return Response.json({ error: 'Forbidden: admin access required' }, { status: 403 });
    }

    const today = new Date().toISOString().slice(0, 10);

    // Fetch all overdue invoices
    const overdueInvoices = await base44.asServiceRole.entities.Invoice.filter({ status: 'overdue' });

    if (overdueInvoices.length === 0) {
      return Response.json({ success: true, sent: 0, skipped: 0, message: 'No overdue invoices found' });
    }

    // Fetch notifications sent today for overdue invoices to avoid duplicates
    const todayNotifications = await base44.asServiceRole.entities.Notification.filter({
      template_type: 'invoice_overdue',
    });

    const alreadySentToday = new Set(
      todayNotifications
        .filter(n => n.sent_at && n.sent_at.slice(0, 10) === today)
        .map(n => n.related_entity_id)
    );

    let sent = 0;
    let skipped = 0;
    const errors = [];

    for (const invoice of overdueInvoices) {
      // Skip if already notified today
      if (alreadySentToday.has(invoice.id)) {
        skipped++;
        continue;
      }

      // Get customer
      const customers = await base44.asServiceRole.entities.Customer.filter({ id: invoice.customer_id });
      const customer = customers?.[0];
      if (!customer || !customer.email) {
        skipped++;
        continue;
      }

      const daysOverdue = Math.floor((new Date(today) - new Date(invoice.due_date)) / 86400000);
      const amountStr = (invoice.amount_ugx || 0).toLocaleString();

      const subject = `Overdue Payment Notice – Invoice ${invoice.invoice_number}`;
      const body = [
        `Dear ${customer.full_name || 'Valued Customer'},`,
        ``,
        `This is a notice that invoice ${invoice.invoice_number} for UGX ${amountStr} is now ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue (due date: ${invoice.due_date}).`,
        ``,
        `To avoid service interruption, please settle this payment immediately via Mobile Money or bank transfer.`,
        ``,
        `Your account number: ${customer.account_number || customer.id.slice(0, 8)}`,
        ``,
        `If you have already made this payment, please disregard this notice or contact our support team.`,
        ``,
        `Thank you,`,
        `WasteConn Billing Team`,
      ].join('\n');

      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: customer.email,
          subject,
          body,
          from_name: 'WasteConn Billing',
        });

        await base44.asServiceRole.entities.Notification.create({
          tenant_id: invoice.tenant_id,
          customer_id: invoice.customer_id,
          recipient_email: customer.email,
          channel: 'email',
          template_type: 'invoice_overdue',
          subject,
          body,
          status: 'sent',
          sent_at: new Date().toISOString(),
          related_entity_type: 'Invoice',
          related_entity_id: invoice.id,
        });

        sent++;
      } catch (err) {
        errors.push({ invoice_id: invoice.id, invoice_number: invoice.invoice_number, error: err.message });
      }
    }

    return Response.json({
      success: true,
      sent,
      skipped,
      errors_count: errors.length,
      errors,
      message: `Sent ${sent} overdue notices. Skipped ${skipped} (already notified or no email).`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});