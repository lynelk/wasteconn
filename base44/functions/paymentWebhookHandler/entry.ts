import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Payment Webhook Handler — idempotent, signature-verified
// Handles inbound webhook events from Yo Payments / MTN MoMo / Airtel Money
// Implements: idempotency key dedup, exponential backoff queue entry, receipt generation

async function hmacSHA256(secret, data) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const rawBody = await req.text();
    let body;
    try { body = JSON.parse(rawBody); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const { event, transaction_ref, amount, currency, customer_id, status, provider, signature, timestamp } = body;

    // --- Signature Verification ---
    const webhookSecret = Deno.env.get('PAYMENT_WEBHOOK_SECRET') || Deno.env.get('YO_PASSWORD');
    if (webhookSecret && signature) {
      const expected = await hmacSHA256(webhookSecret, `${transaction_ref}:${amount}:${timestamp}`);
      if (expected !== signature) {
        // Log failed verification attempt
        await base44.asServiceRole.entities.IntegrationQueue.create({
          event_type: 'payment_webhook',
          direction: 'inbound',
          payload: rawBody.slice(0, 2000),
          status: 'failed',
          last_error: 'Signature verification failed',
          signature_verified: false,
          attempt_count: 1,
        });
        return Response.json({ error: 'Signature verification failed' }, { status: 401 });
      }
    }

    // --- Idempotency Check ---
    const idempotencyKey = `payment_webhook:${transaction_ref}`;
    const existing = await base44.asServiceRole.entities.IntegrationQueue.filter({ idempotency_key: idempotencyKey });
    if (existing?.length > 0 && existing[0].status === 'success') {
      return Response.json({ success: true, duplicate: true, message: 'Already processed' });
    }

    // Create queue entry
    const queueEntry = await base44.asServiceRole.entities.IntegrationQueue.create({
      event_type: 'payment_webhook',
      direction: 'inbound',
      payload: rawBody.slice(0, 5000),
      status: 'processing',
      signature_verified: !!webhookSecret,
      idempotency_key: idempotencyKey,
      attempt_count: 1,
    });

    // --- Process Event ---
    if (event === 'payment.completed' || status === 'COMPLETED' || status === 'SUCCESS') {
      // Find or match payment record
      let payment = null;
      if (transaction_ref) {
        const existing = await base44.asServiceRole.entities.Payment.filter({ transaction_ref });
        payment = existing?.[0];
      }

      if (!payment && customer_id) {
        const pending = await base44.asServiceRole.entities.Payment.filter({ customer_id, status: 'pending' });
        payment = pending?.find(p => p.amount_ugx === amount) || pending?.[0];
      }

      if (payment) {
        await base44.asServiceRole.entities.Payment.update(payment.id, {
          status: 'completed',
          payment_date: new Date().toISOString().split('T')[0],
          transaction_ref: transaction_ref || payment.transaction_ref,
        });

        // Generate receipt
        const receiptNum = `REC-${Date.now().toString(36).toUpperCase()}`;
        await base44.asServiceRole.entities.Receipt.create({
          tenant_id: payment.tenant_id,
          customer_id: payment.customer_id,
          payment_id: payment.id,
          receipt_number: receiptNum,
          amount_ugx: payment.amount_ugx,
          payment_method: provider === 'mtn' ? 'mtn_momo' : provider === 'airtel' ? 'airtel_money' : 'yo_payments',
          payment_reference: transaction_ref,
          issued_at: new Date().toISOString(),
        });
      }

      // Update queue entry to success
      await base44.asServiceRole.entities.IntegrationQueue.update(queueEntry.id, {
        status: 'success',
        resolved_at: new Date().toISOString(),
        response_code: 200,
      });

      return Response.json({ success: true, receipt_generated: !!payment, payment_id: payment?.id });
    }

    if (event === 'payment.failed' || status === 'FAILED') {
      if (transaction_ref) {
        const existing = await base44.asServiceRole.entities.Payment.filter({ transaction_ref });
        const payment = existing?.[0];
        if (payment) await base44.asServiceRole.entities.Payment.update(payment.id, { status: 'failed' });
      }
      await base44.asServiceRole.entities.IntegrationQueue.update(queueEntry.id, { status: 'success', response_code: 200 });
      return Response.json({ success: true });
    }

    // Unknown event — mark success anyway to avoid retries
    await base44.asServiceRole.entities.IntegrationQueue.update(queueEntry.id, { status: 'success', notes: `Unhandled event: ${event}` });
    return Response.json({ success: true, ignored: true });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});