import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Yo! Payments integration for Circular Economy orders.
// Requires secrets: YO_API_URL, YO_USERNAME, YO_PASSWORD (or API key)
// Supports initiating mobile money requests via Yo! Payments Uganda API.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { order_id, amount, customer_phone, reference } = await req.json();

    if (!order_id || !amount) {
      return Response.json({ error: 'order_id and amount required' }, { status: 400 });
    }

    const yoApiUrl = Deno.env.get('YO_API_URL');
    const yoUsername = Deno.env.get('YO_USERNAME');
    const yoPassword = Deno.env.get('YO_PASSWORD');

    // If Yo! credentials not yet configured, return a mock response for testing
    if (!yoApiUrl || !yoUsername || !yoPassword) {
      // Provision mode - credentials not set yet
      await base44.asServiceRole.entities.CustomerOrder.update(order_id, {
        payment_status: 'pending',
        payment_reference: `YO-PROVISIONED-${reference}`,
      });
      return Response.json({
        success: true,
        provisioned: true,
        message: 'Yo! Payments not yet configured. Set YO_API_URL, YO_USERNAME, YO_PASSWORD secrets.',
        payment_url: null,
        order_id,
      });
    }

    // Build Yo! Payments XML request
    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<AutoCreate>
  <Request>
    <APIUsername>${yoUsername}</APIUsername>
    <APIPassword>${yoPassword}</APIPassword>
    <Method>acdepositfunds</Method>
    <Account>${customer_phone}</Account>
    <Amount>${amount}</Amount>
    <ExternalReference>${reference}</ExternalReference>
    <DepositNarration>NLSWMS Eco Store Order ${reference}</DepositNarration>
    <InternalReference>${order_id}</InternalReference>
    <NonBlocking>FALSE</NonBlocking>
  </Request>
</AutoCreate>`;

    const res = await fetch(yoApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml' },
      body: xmlBody,
    });

    const text = await res.text();

    // Parse status from Yo! response
    const statusMatch = text.match(/<Status>([^<]+)<\/Status>/);
    const status = statusMatch?.[1];
    const transRefMatch = text.match(/<TransactionReference>([^<]+)<\/TransactionReference>/);
    const transRef = transRefMatch?.[1];

    const paid = status === 'OK';
    await base44.asServiceRole.entities.CustomerOrder.update(order_id, {
      payment_status: paid ? 'paid' : 'pending',
      payment_reference: transRef || reference,
    });

    return Response.json({
      success: true,
      paid,
      status,
      payment_reference: transRef || reference,
      order_id,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});