import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Yo! Payments — initiate mobile money collection request.
 * Accepts both old (order_id) and new (customer_id) payload shapes for compatibility.
 * Required: amount + one of { customer_id, order_id }
 * Phone: phone OR phone_number
 * Amount: amount_ugx OR amount
 */

function detectNetwork(phone: string): 'mtn_momo' | 'airtel_money' {
  // Normalise to local format (strip +256 or 256 country code, strip leading 0)
  const n = phone.replace(/^\+?256/, '').replace(/^0/, '');
  // MTN Uganda: 077x, 078x, 039x (039 is MTN virtual)
  // Airtel Uganda: 070x, 075x, 074x
  if (['77', '78', '39'].some(p => n.startsWith(p))) return 'mtn_momo';
  return 'airtel_money';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();

    // Normalise params — support both call conventions
    const customer_id = body.customer_id || null;
    const order_id    = body.order_id    || null;
    const phone       = body.phone || body.phone_number || null;
    const amount      = body.amount_ugx  || body.amount  || null;
    const narration   = body.narration   || body.reference || `NLSWMS Payment`;
    const reference   = body.reference   || `PAY-${Date.now()}`;

    if (!amount || (!customer_id && !order_id)) {
      return Response.json({ error: 'amount and one of customer_id / order_id are required' }, { status: 400 });
    }

    const yoApiUrl  = Deno.env.get('YO_API_URL');
    const yoUsername = Deno.env.get('YO_USERNAME');
    const yoPassword = Deno.env.get('YO_PASSWORD');

    // Graceful provisioning mode — no Yo! credentials yet
    if (!yoApiUrl || !yoUsername || !yoPassword) {
      const msg = 'Yo! Payments not yet configured. Set YO_API_URL, YO_USERNAME, YO_PASSWORD secrets.';
      if (order_id) await base44.asServiceRole.entities.CustomerOrder.update(order_id, { payment_status: 'pending', payment_reference: `YO-PROVISIONED-${reference}` });
      return Response.json({ success: true, provisioned: true, message: msg, order_id, customer_id });
    }

    if (!phone) return Response.json({ error: 'phone / phone_number required' }, { status: 400 });

    // --- Idempotency check ---
    // Prevent double-charging the same customer the same amount within 5 minutes
    if (customer_id) {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const recent = await base44.asServiceRole.entities.Payment.filter({ customer_id, status: 'pending' });
      const duplicate = recent.find(p =>
        p.amount_ugx === parseFloat(amount) &&
        (p.created_date || '') >= fiveMinAgo
      );
      if (duplicate) {
        return Response.json({
          success: true,
          duplicate: true,
          message: 'A pending payment for this customer and amount was initiated recently.',
          payment_reference: duplicate.transaction_ref,
          customer_id,
        });
      }
    }

    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<AutoCreate>
  <Request>
    <APIUsername>${yoUsername}</APIUsername>
    <APIPassword>${yoPassword}</APIPassword>
    <Method>acdepositfunds</Method>
    <Account>${phone}</Account>
    <Amount>${amount}</Amount>
    <ExternalReference>${reference}</ExternalReference>
    <DepositNarration>${narration}</DepositNarration>
    <InternalReference>${customer_id || order_id}</InternalReference>
    <NonBlocking>FALSE</NonBlocking>
  </Request>
</AutoCreate>`;

    const res  = await fetch(yoApiUrl, { method: 'POST', headers: { 'Content-Type': 'application/xml' }, body: xmlBody });
    const text = await res.text();

    const statusMatch = text.match(/<Status>([^<]+)<\/Status>/);
    const status      = statusMatch?.[1];
    const transRefMatch = text.match(/<TransactionReference>([^<]+)<\/TransactionReference>/);
    const transRef    = transRefMatch?.[1];
    const paid        = status === 'OK';

    // Update the relevant entity
    if (order_id) {
      await base44.asServiceRole.entities.CustomerOrder.update(order_id, { payment_status: paid ? 'paid' : 'pending', payment_reference: transRef || reference });
    }
    if (customer_id) {
      const network = detectNetwork(phone);
      if (paid) {
        await base44.asServiceRole.entities.Payment.create({
          customer_id,
          amount_ugx: parseFloat(amount),
          payment_method: network,
          transaction_ref: transRef || reference,
          status: 'completed',
          payment_date: new Date().toISOString().slice(0, 10),
          notes: narration,
        });
      } else {
        // Record as pending so idempotency + polling can track it
        await base44.asServiceRole.entities.Payment.create({
          customer_id,
          amount_ugx: parseFloat(amount),
          payment_method: network,
          transaction_ref: transRef || reference,
          status: 'pending',
          payment_date: new Date().toISOString().slice(0, 10),
          notes: narration,
        });
      }
    }

    return Response.json({ success: true, paid, status, payment_reference: transRef || reference, customer_id, order_id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
