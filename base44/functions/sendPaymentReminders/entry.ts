import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Sends payment reminders via email AND SMS (CitoConnect).
// Checks invoices due in X days (per ServicePlan settings) and fires both channels.

const CITO_BASE_URL = (() => {
  const url = Deno.env.get('CITOCONNECT_API_URL') || '';
  return url.startsWith('http') ? url.replace(/\/$/, '') : '';
})();

async function sendSms(phone: string, message: string) {
  const apiKey = Deno.env.get('CITOCONNECT_API_KEY');
  if (!apiKey || !CITO_BASE_URL) return; // provisioned mode — skip silently
  await fetch(`${CITO_BASE_URL}/v1/sms/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({ to: phone, message }),
  }).catch(() => {}); // non-blocking; email is the primary channel
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !['admin', 'super_admin'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const invoices = await base44.asServiceRole.entities.Invoice.filter({ status: 'issued' });

    let sent = 0;
    let smsSent = 0;

    for (const invoice of invoices) {
      if (!invoice.due_date) continue;

      const daysUntilDue = Math.ceil((new Date(invoice.due_date) - new Date(today)) / 86400000);

      // Get subscription to find plan reminder settings
      let reminderDays = [7, 3, 0]; // defaults
      if (invoice.subscription_id) {
        const subs = await base44.asServiceRole.entities.Subscription.filter({ id: invoice.subscription_id });
        const sub = subs?.[0];
        if (sub?.plan_id) {
          const plans = await base44.asServiceRole.entities.ServicePlan.filter({ id: sub.plan_id });
          const plan = plans?.[0];
          if (plan?.email_reminder_days?.length > 0) reminderDays = plan.email_reminder_days;
        }
      }

      if (!reminderDays.includes(daysUntilDue)) continue;

      // Get customer info
      const customers = await base44.asServiceRole.entities.Customer.filter({ id: invoice.customer_id });
      const customer = customers?.[0];
      if (!customer) continue;

      const dueLine = daysUntilDue === 0
        ? 'due today'
        : daysUntilDue < 0
          ? 'overdue'
          : `due in ${daysUntilDue} days (${invoice.due_date})`;

      const subject = daysUntilDue === 0
        ? `Payment Due Today - Invoice ${invoice.invoice_number}`
        : daysUntilDue < 0
          ? `Overdue Payment - Invoice ${invoice.invoice_number}`
          : `Payment Reminder - Invoice ${invoice.invoice_number} due in ${daysUntilDue} days`;

      const emailBody = `Dear ${customer.full_name || 'Customer'},\n\nThis is a reminder that invoice ${invoice.invoice_number} for ${(invoice.amount_ugx || 0).toLocaleString()} UGX is ${dueLine}.\n\nPlease log in to your customer portal to view and pay your invoice.\n\nThank you.`;

      // --- Email ---
      if (customer.email) {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: customer.email,
          subject,
          body: emailBody,
        });

        await base44.asServiceRole.entities.Notification.create({
          tenant_id: invoice.tenant_id,
          customer_id: invoice.customer_id,
          recipient_email: customer.email,
          channel: 'email',
          template_type: daysUntilDue < 0 ? 'invoice_overdue' : 'invoice_issued',
          subject,
          body: emailBody,
          status: 'sent',
          sent_at: new Date().toISOString(),
          related_entity_type: 'Invoice',
          related_entity_id: invoice.id,
        });

        sent++;
      }

      // --- SMS (East Africa is SMS-first; send even without email) ---
      if (customer.phone) {
        const smsText = daysUntilDue < 0
          ? `NLSWMS: Invoice ${invoice.invoice_number} of UGX ${(invoice.amount_ugx || 0).toLocaleString()} is OVERDUE. Pay now via MoMo. Acct: ${customer.account_number || customer.id.slice(0, 8)}`
          : `NLSWMS: Invoice ${invoice.invoice_number} of UGX ${(invoice.amount_ugx || 0).toLocaleString()} is due ${invoice.due_date}. Pay via MoMo. Acct: ${customer.account_number || customer.id.slice(0, 8)}`;

        await sendSms(customer.phone, smsText);

        await base44.asServiceRole.entities.Notification.create({
          tenant_id: invoice.tenant_id,
          customer_id: invoice.customer_id,
          recipient_phone: customer.phone,
          channel: 'sms',
          template_type: daysUntilDue < 0 ? 'invoice_overdue' : 'invoice_issued',
          subject: `SMS: ${subject}`,
          body: smsText,
          status: 'sent',
          sent_at: new Date().toISOString(),
          related_entity_type: 'Invoice',
          related_entity_id: invoice.id,
        });

        smsSent++;
      }

      // Update invoice status to overdue if past due
      if (daysUntilDue < 0 && invoice.status === 'issued') {
        await base44.asServiceRole.entities.Invoice.update(invoice.id, { status: 'overdue' });
      }
    }

    return Response.json({ success: true, sent, sms_sent: smsSent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
