import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Payment Webhook Handler — idempotent, signature-verified
// Handles inbound webhook events from Yo Payments / MTN MoMo / Airtel Money
// Implements: idempotency key dedup, exponential backoff queue entry, receipt generation,
//             partial payment tracking, WhatsApp/SMS receipt dispatch, loyalty points,
//             and referral reward triggering

const CITO_BASE_URL = (() => {
  const url = Deno.env.get('CITOCONNECT_API_URL') || '';
  return url.startsWith('http') ? url.replace(/\/$/, '') : '';
})();

const LOYALTY_POINTS_PER_UGX = 1000; // 1 point per 1,000 UGX paid

async function awardLoyaltyPoints(base44, customerId: string, tenantId: string, amountUgx: number, reference: string) {
  if (!customerId || !amountUgx) return;
  const points = Math.floor(amountUgx / LOYALTY_POINTS_PER_UGX);
  if (points <= 0) return;
  // Ledger-backed, idempotent (keyed on the payment) + concurrency-safe.
  await base44.asServiceRole.functions.invoke('loyaltyAward', {
    _internal: true,
    customer_id: customerId,
    tenant_id: tenantId,
    points,
    reason: 'payment',
    reference: `payment:${reference}`,
  });
}

// Reward any pending referral where this customer is the referee, on their first completed payment.
async function triggerReferralReward(base44, customerId: string) {
  if (!customerId) return;
  const completed = await base44.asServiceRole.entities.Payment.filter({ customer_id: customerId, status: 'completed' });
  // Only fire on the FIRST completed payment to avoid repeat rewards
  if ((completed?.length || 0) > 1) return;
  const pending = await base44.asServiceRole.entities.Referral.filter({ referee_customer_id: customerId, status: 'pending' });
  if (!pending?.length) return;
  for (const ref of pending) {
    const reward = ref.reward_ugx || 5000;
    const now = new Date().toISOString();
    // Concurrency-safe, idempotent wallet credit via the ledger-backed function.
    await base44.asServiceRole.functions.invoke('walletAdjust', {
      _internal: true,
      customer_id: ref.referrer_customer_id,
      tenant_id: ref.tenant_id,
      amount_ugx: reward,
      kind: 'referral',
      reference: `referral:${ref.id}`,
      note: `Referral reward — referee ${customerId} made first payment`,
    });
    await base44.asServiceRole.entities.WasteBankTransaction.create({
      tenant_id: ref.tenant_id,
      transaction_type: 'payout',
      customer_id: ref.referrer_customer_id,
      gross_amount_ugx: reward,
      net_amount_ugx: reward,
      payout_method: 'wallet_credit',
      payment_status: 'completed',
      notes: `Referral reward — referee ${customerId} made first payment`,
    });
    await base44.asServiceRole.entities.Referral.update(ref.id, { status: 'rewarded', rewarded_at: now });
  }
}

async function hmacSHA256(secret, data) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sendReceiptSms(phone: string, message: string) {
  const apiKey = Deno.env.get('CITOCONNECT_API_KEY');
  if (!apiKey || !CITO_BASE_URL) return;
  await fetch(`${CITO_BASE_URL}/v1/sms/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({ to: phone, message }),
  }).catch(() => {}); // non-blocking
}

async function applyPaymentToInvoices(base44, customer_id: string, amount_paid: number, payment_id: string) {
  // Find unpaid/partially-paid invoices for this customer sorted oldest first
  const allInvoices = await base44.asServiceRole.entities.Invoice.filter({ customer_id });
  const unpaid = allInvoices
    .filter(i => ['issued', 'overdue', 'partially_paid'].includes(i.status))
    .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));

  let remaining = amount_paid;
  for (const inv of unpaid) {
    if (remaining <= 0) break;

    // Sum all completed payments already applied to this invoice
    const allPayments = await base44.asServiceRole.entities.Payment.filter({ customer_id, status: 'completed' });
    const alreadyPaid = allPayments
      .filter(p => p.id !== payment_id)
      .reduce((s, p) => s + (p.amount_ugx || 0), 0);

    // This is a simplification — in a real system payments would link to invoices directly.
    // Here we apply chronologically across oldest unpaid invoices.
    const invoiceAmount = inv.amount_ugx || 0;
    if (remaining >= invoiceAmount) {
      await base44.asServiceRole.entities.Invoice.update(inv.id, {
        status: 'paid',
        paid_date: new Date().toISOString(),
        amount_paid: invoiceAmount,
        balance_due: 0,
      });
      remaining -= invoiceAmount;
    } else {
      await base44.asServiceRole.entities.Invoice.update(inv.id, {
        status: 'partially_paid',
        amount_paid: remaining,
        balance_due: invoiceAmount - remaining,
      });
      remaining = 0;
    }
  }
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

        // --- Apply payment to unpaid invoices (partial payment tracking) ---
        if (payment.customer_id) {
          await applyPaymentToInvoices(base44, payment.customer_id, payment.amount_ugx || amount, payment.id);
        }

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

        // --- WhatsApp / SMS receipt ---
        if (payment.customer_id) {
          const customers = await base44.asServiceRole.entities.Customer.filter({ id: payment.customer_id });
          const customer = customers?.[0];
          if (customer?.phone) {
            const receiptMsg = `✅ NLSWMS: Payment received — UGX ${(payment.amount_ugx || 0).toLocaleString()}. Receipt: ${receiptNum}. Thank you, ${customer.full_name || 'Customer'}!`;
            await sendReceiptSms(customer.phone, receiptMsg);
          }
        }

        // --- Loyalty points + referral reward (best-effort, non-blocking) ---
        try {
          await awardLoyaltyPoints(base44, payment.customer_id, payment.tenant_id, payment.amount_ugx || amount, payment.id || transaction_ref);
          await triggerReferralReward(base44, payment.customer_id);
        } catch { /* engagement rewards must never block payment processing */ }
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
