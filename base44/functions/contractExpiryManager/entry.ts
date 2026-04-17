import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Runs daily - marks expired contracts, sends renewal reminders 30 days before end
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // 30-day lookahead for renewal reminders
  const reminderDate = new Date(today);
  reminderDate.setDate(reminderDate.getDate() + 30);
  const reminderDateStr = reminderDate.toISOString().split('T')[0];

  const allSubs = await base44.asServiceRole.entities.Subscription.list();

  let expired = 0;
  let reminded = 0;
  const errors = [];

  for (const sub of allSubs) {
    if (!sub.end_date) continue;

    // Mark expired
    if (sub.status === 'active' && sub.end_date < todayStr) {
      try {
        await base44.asServiceRole.entities.Subscription.update(sub.id, { status: 'expired' });
        expired++;

        // Create audit log entry
        await base44.asServiceRole.entities.AuditLog.create({
          event_type: 'Subscription.expired',
          entity_type: 'Subscription',
          entity_id: sub.id,
          actor: 'system',
          description: `Contract auto-expired on ${todayStr}`,
          new_state: JSON.stringify({ status: 'expired', end_date: sub.end_date }),
          risk_score: 20,
        });
      } catch (e) {
        errors.push(`expire ${sub.id}: ${e.message}`);
      }
    }

    // Send renewal reminder 30 days before end, for non-auto-renew active contracts
    if (
      sub.status === 'active' &&
      !sub.auto_renew &&
      !sub.renewal_reminder_sent &&
      sub.end_date === reminderDateStr
    ) {
      try {
        // Fetch customer
        const customers = await base44.asServiceRole.entities.Customer.filter({ id: sub.customer_id });
        const customer = customers[0];
        if (customer?.email) {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: customer.email,
            subject: 'Your waste collection contract expires in 30 days',
            body: `Dear ${customer.full_name},\n\nYour service contract (ending ${sub.end_date}) will expire in 30 days and is not set to auto-renew.\n\nPlease contact us to renew or discuss options.\n\nThank you,\nNLSWMS Team`,
          });
        }
        await base44.asServiceRole.entities.Subscription.update(sub.id, { renewal_reminder_sent: true });
        reminded++;
      } catch (e) {
        errors.push(`remind ${sub.id}: ${e.message}`);
      }
    }
  }

  return Response.json({ expired, reminded, errors, checked: allSubs.length });
});