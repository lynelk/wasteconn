import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Allow override via secret for production endpoint
const CITO_BASE_URL = Deno.env.get('CITOCONNECT_API_URL') || 'https://api.cito.gateway';

async function getCitoToken() {
  const apiKey = Deno.env.get('CITOCONNECT_API_KEY');
  if (!apiKey) throw new Error('CITOCONNECT_API_KEY not set');
  const res = await fetch(`${CITO_BASE_URL}/v1/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, grant_type: 'api_key' }),
  });
  if (!res.ok) {
    // Return mock token in sandbox/test environments where the gateway is unreachable
    const errorText = await res.text().catch(() => 'network error');
    throw new Error(`CitoConnect auth failed (${res.status}): ${errorText}`);
  }
  const data = await res.json();
  if (!data.access_token) throw new Error(`CitoConnect auth failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function citoRequest(token, path, body) {
  const res = await fetch(`${CITO_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`CitoConnect ${path} failed (${res.status}): ${err}`);
  }
  return res.json();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, ...params } = await req.json();

    if (!action) return Response.json({ error: 'action is required' }, { status: 400 });

    // Validate CitoConnect key presence before attempting auth
    const apiKey = Deno.env.get('CITOCONNECT_API_KEY');
    if (!apiKey) {
      return Response.json({
        success: false,
        provisioned: true,
        message: 'CitoConnect not configured. Set CITOCONNECT_API_KEY secret.',
        action,
      });
    }

    let token;
    try {
      token = await getCitoToken();
    } catch (authErr) {
      // Gateway unreachable — return informative provisioned response instead of 500
      return Response.json({
        success: false,
        provisioned: true,
        message: `CitoConnect gateway unreachable. Verify CITOCONNECT_API_URL is correct and the service is reachable. Error: ${authErr.message}`,
        action,
      });
    }

    if (action === 'send_sms') {
      const result = await citoRequest(token, '/v1/sms/send', params);
      return Response.json(result);
    }
    if (action === 'collect_payment') {
      const result = await citoRequest(token, '/v1/payments/collect', params);
      return Response.json(result);
    }
    if (action === 'disburse_payment') {
      const result = await citoRequest(token, '/v1/payments/disburse', params);
      return Response.json(result);
    }
    if (action === 'verify_and_payout') {
      const result = await citoRequest(token, '/functions/verifyAndPayout', { action: 'initiate_payout', ...params });
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
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});