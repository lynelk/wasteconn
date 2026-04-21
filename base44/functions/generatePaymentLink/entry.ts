import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Generates a time-limited (48hr) shareable payment link for an invoice.
// The token is stored in a PaymentLink entity.
// Frontend PayPage (/pay/:token) uses this to render a self-service payment screen.

function generateToken(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !['admin', 'super_admin'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { invoice_id, customer_id, amount_ugx, description, expires_hours } = await req.json();

    if (!customer_id || !amount_ugx) {
      return Response.json({ error: 'customer_id and amount_ugx are required' }, { status: 400 });
    }

    const expiresAt = new Date(Date.now() + (expires_hours || 48) * 3600000).toISOString();
    const token = generateToken();

    const link = await base44.asServiceRole.entities.PaymentLink.create({
      token,
      customer_id,
      invoice_id: invoice_id || null,
      amount_ugx: parseFloat(amount_ugx),
      description: description || 'NLSWMS Payment',
      status: 'active',
      expires_at: expiresAt,
      created_by: user.id || user.email,
      created_at: new Date().toISOString(),
    });

    // Optionally send the link to the customer via SMS
    const customers = await base44.asServiceRole.entities.Customer.filter({ id: customer_id });
    const customer = customers?.[0];

    const appBaseUrl = Deno.env.get('APP_BASE_URL') || 'https://app.nlswms.com';
    const payUrl = `${appBaseUrl}/pay/${token}`;

    const CITO_BASE_URL = (() => {
      const url = Deno.env.get('CITOCONNECT_API_URL') || '';
      return url.startsWith('http') ? url.replace(/\/$/, '') : '';
    })();
    const apiKey = Deno.env.get('CITOCONNECT_API_KEY');

    let smsSent = false;
    if (customer?.phone && apiKey && CITO_BASE_URL) {
      const smsText = `NLSWMS: Pay UGX ${parseFloat(amount_ugx).toLocaleString()} via this secure link: ${payUrl} (expires ${new Date(expiresAt).toLocaleDateString('en-UG')})`;
      const smsRes = await fetch(`${CITO_BASE_URL}/v1/sms/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}`, 'X-API-Key': apiKey },
        body: JSON.stringify({ to: customer.phone, message: smsText }),
      }).catch(() => null);
      smsSent = smsRes?.ok || false;
    }

    return Response.json({
      success: true,
      token,
      pay_url: payUrl,
      expires_at: expiresAt,
      sms_sent: smsSent,
      link_id: link.id,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
