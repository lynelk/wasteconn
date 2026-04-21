import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Polling fallback for payments that didn't receive a webhook.
// Run on a schedule (every 10 minutes).
// - Verifies pending Yo! Payments via the status API
// - Expires stale payments (pending > 2 hours with no update)
// Benchmarked against Paystack/Flutterwave: both poll at T+2min, T+10min, T+1hr

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

    const now = new Date();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();

    // Fetch all pending payments
    const allPending = await base44.asServiceRole.entities.Payment.filter({ status: 'pending' });

    // Only consider payments older than 5 minutes (give webhook a chance first)
    const eligibleForPoll = allPending.filter(p => (p.created_date || '') < fiveMinAgo);

    let verified = 0;
    let expired = 0;
    let failed = 0;

    for (const payment of eligibleForPoll) {
      const isStale = (payment.created_date || '') < twoHoursAgo;

      // Expire truly stale payments (> 2 hours)
      if (isStale) {
        await base44.asServiceRole.entities.Payment.update(payment.id, { status: 'expired' });
        await base44.asServiceRole.entities.Notification.create({
          customer_id: payment.customer_id,
          tenant_id: payment.tenant_id,
          channel: 'system',
          template_type: 'payment_expired',
          subject: `Payment expired: ${payment.transaction_ref || payment.id}`,
          body: `Payment of UGX ${(payment.amount_ugx || 0).toLocaleString()} expired after 2 hours without confirmation.`,
          status: 'sent',
          sent_at: now.toISOString(),
          related_entity_type: 'Payment',
          related_entity_id: payment.id,
        });
        expired++;
        continue;
      }

      // Verify with Yo! Payments if credentials are available and we have a ref
      if (!yoApiUrl || !yoUsername || !yoPassword || !payment.transaction_ref) continue;

      try {
        const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<AutoCreate>
  <Request>
    <APIUsername>${yoUsername}</APIUsername>
    <APIPassword>${yoPassword}</APIPassword>
    <Method>actransactioncheckstatus</Method>
    <TransactionReference>${payment.transaction_ref}</TransactionReference>
    <NonBlocking>FALSE</NonBlocking>
  </Request>
</AutoCreate>`;

        const res = await fetch(yoApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/xml' },
          body: xmlBody,
        });
        const text = await res.text();

        const statusMatch = text.match(/<Status>([^<]+)<\/Status>/);
        const yoStatus = statusMatch?.[1];

        if (yoStatus === 'OK' || yoStatus === 'SUCCESS') {
          await base44.asServiceRole.entities.Payment.update(payment.id, {
            status: 'completed',
            payment_date: now.toISOString().slice(0, 10),
          });

          // Generate receipt
          const receiptNum = `REC-${Date.now().toString(36).toUpperCase()}`;
          await base44.asServiceRole.entities.Receipt.create({
            tenant_id: payment.tenant_id,
            customer_id: payment.customer_id,
            payment_id: payment.id,
            receipt_number: receiptNum,
            amount_ugx: payment.amount_ugx,
            payment_method: payment.payment_method || 'yo_payments',
            payment_reference: payment.transaction_ref,
            issued_at: now.toISOString(),
          });

          verified++;
        } else if (yoStatus === 'FAILED' || yoStatus === 'CANCELLED') {
          await base44.asServiceRole.entities.Payment.update(payment.id, { status: 'failed' });
          failed++;
        }
        // PENDING status: leave as-is and retry on next run
      } catch {}
    }

    return Response.json({
      success: true,
      polled: eligibleForPoll.length,
      verified,
      expired,
      failed,
      run_at: now.toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
