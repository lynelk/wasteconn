import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * CitoConnect — SMS and payment disbursement gateway.
 * Authenticates using CITOCONNECT_API_KEY directly in the Authorization header.
 * Set CITOCONNECT_API_URL to override the default base URL (e.g. https://api.citoconnect.com).
 */

const CITO_BASE_URL = (() => {
  const url = Deno.env.get('CITOCONNECT_API_URL') || '';
  // Guard: if the secret looks like a key (no http), fall back to empty so we hit provisioned mode
  return url.startsWith('http') ? url.replace(/\/$/, '') : '';
})();

async function citoRequest(path, body) {
  const apiKey = Deno.env.get('CITOCONNECT_API_KEY');
  const res = await fetch(`${CITO_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'X-API-Key': apiKey,
    },
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

    const apiKey = Deno.env.get('CITOCONNECT_API_KEY');
    if (!apiKey || !CITO_BASE_URL) {
      return Response.json({
        success: false,
        provisioned: true,
        message: !apiKey
          ? 'CITOCONNECT_API_KEY not set.'
          : 'CITOCONNECT_API_URL must start with https://. Please set the correct CitoConnect base URL.',
        action,
      });
    }

    if (action === 'send_sms') {
      const result = await citoRequest('/v1/sms/send', params);
      return Response.json(result);
    }
    if (action === 'collect_payment') {
      const result = await citoRequest('/v1/payments/collect', params);
      return Response.json(result);
    }
    if (action === 'disburse_payment') {
      const result = await citoRequest('/v1/payments/disburse', params);
      return Response.json(result);
    }
    if (action === 'verify_and_payout') {
      const result = await citoRequest('/v1/payments/payout', { action: 'initiate_payout', ...params });
      return Response.json(result);
    }
    if (action === 'get_transaction_stats') {
      const apiKey2 = Deno.env.get('CITOCONNECT_API_KEY');
      const res = await fetch(`${CITO_BASE_URL}/v1/analytics/transactions`, {
        headers: { 'Authorization': `Bearer ${apiKey2}`, 'X-API-Key': apiKey2 },
      });
      return Response.json(await res.json());
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});