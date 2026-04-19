import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const CITO_BASE_URL = 'https://api.cito.gateway';

async function getCitoToken() {
  const apiKey = Deno.env.get('CITOCONNECT_API_KEY');
  const res = await fetch(`${CITO_BASE_URL}/v1/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, grant_type: 'api_key' }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`CitoConnect auth failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function citoRequest(token, path, body) {
  const res = await fetch(`${CITO_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { action, ...params } = await req.json();

  const token = await getCitoToken();

  if (action === 'send_sms') {
    // params: { to, message, sender_id?, reference? }
    const result = await citoRequest(token, '/v1/sms/send', params);
    return Response.json(result);
  }

  if (action === 'collect_payment') {
    // params: { amount, currency, phone, reference, description?, callback_url? }
    const result = await citoRequest(token, '/v1/payments/collect', params);
    return Response.json(result);
  }

  if (action === 'disburse_payment') {
    // params: { amount, currency, phone, reference, description? }
    const result = await citoRequest(token, '/v1/payments/disburse', params);
    return Response.json(result);
  }

  if (action === 'verify_and_payout') {
    // params: { amount, phone, currency?, reference?, description? }
    const result = await citoRequest(token, '/functions/verifyAndPayout', {
      action: 'initiate_payout',
      ...params,
    });
    return Response.json(result);
  }

  if (action === 'get_transaction_stats') {
    const res = await fetch(`${CITO_BASE_URL}/v1/analytics/transactions`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const result = await res.json();
    return Response.json(result);
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
});