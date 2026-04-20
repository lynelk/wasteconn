import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Subscription Auto-Renewal Retry
// Runs daily. Finds active subscriptions whose last payment failed,
// then retries up to 3 times over 3 days before suspending.
// Mirrors Paystack's subscription retry policy.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !['admin', 'super_admin'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const yoApiUrl  = Deno.env.get('YO_API_URL');
    const yoUsername = Deno.env.get('YO_USERNAME');
    const yoPassword = Deno.env.get('YO_PASSWORD');

    const today = new Date().toISOString().slice(0, 10);
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);

    // Get active subscriptions
    const subscriptions = await base44.asServiceRole.entities.Subscription.filter({ status: 'active' });

    let retried = 0;
    let suspended = 0;

    for (const sub of subscriptions) {
      if (!sub.customer_id) continue;

      // Find recent failed payments for this customer
      const recentPayments = await base44.asServiceRole.entities.Payment.filter({ customer_id: sub.customer_id, status: 'failed' });
      const recentFailed = recentPayments.filter(p => (p.payment_date || p.created_date || '') >= threeDaysAgo);

      if (recentFailed.length === 0) continue;

      // Count retry attempts (failed payments in last 3 days)
      const retryCount = recentFailed.length;

      // After 3 failures, suspend subscription
      if (retryCount >= 3) {
        await base44.asServiceRole.entities.Subscription.update(sub.id, {
          status: 'suspended',
          suspension_reason: 'payment_failure',
          suspended_at: new Date().toISOString(),
        });

        // Notify customer
        const customers = await base44.asServiceRole.entities.Customer.filter({ id: sub.customer_id });
        const customer = customers?.[0];
        if (customer) {
          await base44.asServiceRole.entities.Notification.create({
            customer_id: sub.customer_id,
            tenant_id: sub.tenant_id,
            channel: 'email',
            template_type: 'subscription_suspended',
            subject: 'Your NLSWMS subscription has been suspended',
            body: `Dear ${customer.full_name || 'Customer'},\n\nYour subscription has been suspended after ${retryCount} failed payment attempts. Please update your payment method or contact support to reinstate your service.\n\nThank you.`,
            recipient_email: customer.email,
            status: 'sent',
            sent_at: new Date().toISOString(),
            related_entity_type: 'Subscription',
            related_entity_id: sub.id,
          });
        }

        suspended++;
        continue;
      }

      // Retry payment if credentials available
      if (!yoApiUrl || !yoUsername || !yoPassword) continue;

      const customers = await base44.asServiceRole.entities.Customer.filter({ id: sub.customer_id });
      const customer = customers?.[0];
      const phone = customer?.phone || customer?.mobile_number;
      if (!phone) continue;

      // Get subscription amount from service plan
      let amount = sub.amount_ugx || sub.monthly_amount;
      if (!amount && sub.plan_id) {
        const plans = await base44.asServiceRole.entities.ServicePlan.filter({ id: sub.plan_id });
        amount = plans?.[0]?.monthly_fee_ugx || plans?.[0]?.base_price_ugx;
      }
      if (!amount) continue;

      const reference = `RETRY-${sub.id.slice(0, 8)}-${Date.now()}`;
      const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<AutoCreate>
  <Request>
    <APIUsername>${yoUsername}</APIUsername>
    <APIPassword>${yoPassword}</APIPassword>
    <Method>acdepositfunds</Method>
    <Account>${phone}</Account>
    <Amount>${amount}</Amount>
    <ExternalReference>${reference}</ExternalReference>
    <DepositNarration>NLSWMS Subscription Renewal (Attempt ${retryCount + 1})</DepositNarration>
    <InternalReference>${sub.customer_id}</InternalReference>
    <NonBlocking>FALSE</NonBlocking>
  </Request>
</AutoCreate>`;

      try {
        const res = await fetch(yoApiUrl, { method: 'POST', headers: { 'Content-Type': 'application/xml' }, body: xmlBody });
        const text = await res.text();
        const statusMatch = text.match(/<Status>([^<]+)<\/Status>/);
        const transRefMatch = text.match(/<TransactionReference>([^<]+)<\/TransactionReference>/);
        const paid = statusMatch?.[1] === 'OK';

        await base44.asServiceRole.entities.Payment.create({
          customer_id: sub.customer_id,
          tenant_id: sub.tenant_id,
          amount_ugx: parseFloat(amount),
          payment_method: 'yo_payments',
          transaction_ref: transRefMatch?.[1] || reference,
          status: paid ? 'completed' : 'failed',
          payment_date: today,
          notes: `Subscription retry attempt ${retryCount + 1}`,
        });

        if (paid) {
          await base44.asServiceRole.entities.Subscription.update(sub.id, {
            last_payment_date: today,
            payment_failure_count: 0,
          });
        }

        retried++;
      } catch {}
    }

    return Response.json({ success: true, retried, suspended, run_at: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
