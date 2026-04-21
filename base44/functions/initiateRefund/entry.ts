import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Initiates a payment refund via CitoConnect disburse_payment.
// Records a refund Payment record and updates the related invoice if provided.
// Requires: payment_id (original payment) + optional reason

const CITO_BASE_URL = (() => {
  const url = Deno.env.get('CITOCONNECT_API_URL') || '';
  return url.startsWith('http') ? url.replace(/\/$/, '') : '';
})();

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !['admin', 'super_admin'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { payment_id, reason, partial_amount } = await req.json();
    if (!payment_id) return Response.json({ error: 'payment_id is required' }, { status: 400 });

    const payments = await base44.asServiceRole.entities.Payment.filter({ id: payment_id });
    const original = payments?.[0];
    if (!original) return Response.json({ error: 'Payment not found' }, { status: 404 });

    if (!['completed', 'under_review'].includes(original.status)) {
      return Response.json({ error: `Cannot refund a payment with status: ${original.status}` }, { status: 400 });
    }

    const refundAmount = partial_amount || original.amount_ugx;

    // Get customer phone for disbursement
    const customers = await base44.asServiceRole.entities.Customer.filter({ id: original.customer_id });
    const customer = customers?.[0];
    const phone = customer?.phone || customer?.mobile_number;
    if (!phone) return Response.json({ error: 'Customer phone number not found for disbursement' }, { status: 400 });

    const refundRef = `REF-${original.transaction_ref || original.id.slice(0, 8)}-${Date.now()}`;

    // Provisioned mode — no CitoConnect credentials
    const apiKey = Deno.env.get('CITOCONNECT_API_KEY');
    if (!apiKey || !CITO_BASE_URL) {
      // Record refund in provisioned mode
      await base44.asServiceRole.entities.Payment.create({
        customer_id: original.customer_id,
        tenant_id: original.tenant_id,
        amount_ugx: -refundAmount,
        payment_method: original.payment_method,
        transaction_ref: refundRef,
        status: 'completed',
        payment_date: new Date().toISOString().slice(0, 10),
        notes: `Refund of ${original.transaction_ref || payment_id}: ${reason || 'No reason given'}`,
        type: 'refund',
        original_payment_id: payment_id,
      });
      await base44.asServiceRole.entities.Payment.update(payment_id, { status: 'refunded' });
      return Response.json({ success: true, provisioned: true, refund_ref: refundRef, message: 'Refund recorded (CitoConnect not configured)' });
    }

    // Disburse via CitoConnect
    const disburseRes = await fetch(`${CITO_BASE_URL}/v1/payments/disburse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        amount: refundAmount,
        currency: 'UGX',
        phone,
        reference: refundRef,
        description: `Refund: ${reason || 'Customer refund'}`,
      }),
    });

    if (!disburseRes.ok) {
      const errText = await disburseRes.text().catch(() => '');
      return Response.json({ error: `CitoConnect disburse failed: ${errText}` }, { status: 502 });
    }

    const result = await disburseRes.json();

    // Record refund payment
    await base44.asServiceRole.entities.Payment.create({
      customer_id: original.customer_id,
      tenant_id: original.tenant_id,
      amount_ugx: -refundAmount,
      payment_method: original.payment_method,
      transaction_ref: result?.transaction_id || refundRef,
      status: 'completed',
      payment_date: new Date().toISOString().slice(0, 10),
      notes: `Refund of ${original.transaction_ref || payment_id}: ${reason || 'No reason given'}`,
      type: 'refund',
      original_payment_id: payment_id,
    });

    // Mark original payment as refunded
    await base44.asServiceRole.entities.Payment.update(payment_id, { status: 'refunded' });

    // Log in IntegrationQueue
    await base44.asServiceRole.entities.IntegrationQueue.create({
      event_type: 'refund_disbursed',
      direction: 'outbound',
      payload: JSON.stringify({ payment_id, refund_amount: refundAmount, refund_ref: refundRef, reason }),
      status: 'success',
      resolved_at: new Date().toISOString(),
    });

    return Response.json({ success: true, refund_ref: result?.transaction_id || refundRef, amount_refunded: refundAmount });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
