import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  // Validate the API key from the Authorization header
  const authHeader = req.headers.get('Authorization') || '';
  const incomingKey = authHeader.replace('Bearer ', '').trim();
  const expectedKey = Deno.env.get('CITOCONNECT_API_KEY');

  if (!incomingKey || incomingKey !== expectedKey) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const base44 = createClientFromRequest(req);
  const payload = await req.json();
  const { event_type, reference, org_id, data } = payload;

  // Log to IntegrationQueue for audit trail
  await base44.asServiceRole.entities.IntegrationQueue.create({
    event_type: 'payment_webhook',
    direction: 'inbound',
    payload: JSON.stringify(payload),
    endpoint: 'citoConnectWebhook',
    status: 'success',
    idempotency_key: reference || `cito_${Date.now()}`,
    signature_verified: true,
    notes: `CitoConnect event: ${event_type}`,
  });

  // Handle specific event types
  if (event_type === 'payment.success' && reference) {
    const payments = await base44.asServiceRole.entities.Payment.filter({ payment_reference: reference });
    if (payments.length > 0) {
      await base44.asServiceRole.entities.Payment.update(payments[0].id, { status: 'completed' });
    }
  }

  if (event_type === 'payment.failed' && reference) {
    const payments = await base44.asServiceRole.entities.Payment.filter({ payment_reference: reference });
    if (payments.length > 0) {
      await base44.asServiceRole.entities.Payment.update(payments[0].id, { status: 'failed' });
    }
  }

  if (event_type === 'payout.completed' && reference) {
    const txns = await base44.asServiceRole.entities.WasteBankTransaction.filter({ payment_reference: reference });
    if (txns.length > 0) {
      await base44.asServiceRole.entities.WasteBankTransaction.update(txns[0].id, { payment_status: 'completed' });
    }
  }

  if (event_type === 'payout.failed' && reference) {
    const txns = await base44.asServiceRole.entities.WasteBankTransaction.filter({ payment_reference: reference });
    if (txns.length > 0) {
      await base44.asServiceRole.entities.WasteBankTransaction.update(txns[0].id, { payment_status: 'failed' });
    }
  }

  if (event_type === 'sms.delivered' && reference) {
    const notifications = await base44.asServiceRole.entities.Notification.filter({ provider_message_id: reference });
    if (notifications.length > 0) {
      await base44.asServiceRole.entities.Notification.update(notifications[0].id, {
        status: 'delivered',
        delivered_at: new Date().toISOString(),
        delivery_receipt: JSON.stringify(data),
      });
    }
  }

  return Response.json({
    received: true,
    event_type,
    reference,
    timestamp: new Date().toISOString(),
  });
});