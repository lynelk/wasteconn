import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Triggered by entity automation when a Payment record's status changes to 'completed'.
// Sends a formatted receipt email to the customer.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    // Support both direct call and entity automation payload
    const paymentId = body.payment_id || body.data?.id || body.event?.entity_id;
    if (!paymentId) return Response.json({ error: 'payment_id required' }, { status: 400 });

    const paymentArr = await base44.asServiceRole.entities.Payment.filter({ id: paymentId });
    const payment = paymentArr?.[0];
    if (!payment) return Response.json({ error: 'Payment not found' }, { status: 404 });
    if (payment.status !== 'completed') return Response.json({ skipped: true, reason: 'Payment not completed' });

    const customerArr = await base44.asServiceRole.entities.Customer.filter({ id: payment.customer_id });
    const customer = customerArr?.[0];
    if (!customer?.email) return Response.json({ skipped: true, reason: 'No customer email' });

    // Find the associated receipt number if it exists
    const receipts = await base44.asServiceRole.entities.Receipt.filter({ payment_id: paymentId });
    const receiptNumber = receipts?.[0]?.receipt_number || `REC-${paymentId.slice(0, 8).toUpperCase()}`;

    const amountFormatted = (payment.amount_ugx || 0).toLocaleString();
    const paymentDate = payment.payment_date
      ? new Date(payment.payment_date).toLocaleDateString('en-UG', { year: 'numeric', month: 'long', day: 'numeric' })
      : new Date().toLocaleDateString('en-UG', { year: 'numeric', month: 'long', day: 'numeric' });

    const methodLabel = {
      mtn_momo: 'MTN Mobile Money',
      airtel_money: 'Airtel Money',
      yo_payments: 'Yo Payments',
      pesa_pal: 'PesaPal',
      cash: 'Cash',
      bank_transfer: 'Bank Transfer',
    }[payment.payment_method] || payment.payment_method || 'Mobile Money';

    const emailBody = `
Dear ${customer.full_name},

Thank you for your payment! We are pleased to confirm receipt of your payment.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PAYMENT RECEIPT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Receipt Number : ${receiptNumber}
Payment Date   : ${paymentDate}
Amount Paid    : UGX ${amountFormatted}
Payment Method : ${methodLabel}
${payment.transaction_ref ? `Reference      : ${payment.transaction_ref}` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your account has been updated and your services remain active.

If you have any questions about this receipt, please contact our support team.

Thank you for choosing our waste management services.

Warm regards,
NLSWMS Billing Team
    `.trim();

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: customer.email,
      subject: `Payment Receipt ${receiptNumber} — UGX ${amountFormatted}`,
      body: emailBody,
      from_name: 'NLSWMS Billing',
    });

    // Log the notification
    await base44.asServiceRole.entities.Notification.create({
      tenant_id: payment.tenant_id,
      customer_id: payment.customer_id,
      recipient_email: customer.email,
      channel: 'email',
      template_type: 'payment_received',
      subject: `Payment Receipt ${receiptNumber} — UGX ${amountFormatted}`,
      body: emailBody,
      status: 'sent',
      sent_at: new Date().toISOString(),
      related_entity_type: 'Payment',
      related_entity_id: paymentId,
    });

    return Response.json({ success: true, email_sent_to: customer.email, receipt_number: receiptNumber });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});