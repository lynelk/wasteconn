import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * QuickBooks Online Integration
 * Credentials resolution order:
 *   1. IntegrationConfig DB record (api_key=ClientID, api_secret=ClientSecret,
 *      refresh_token, access_token, token_expires_at, settings.realm_id)
 *   2. Environment secrets fallback (QBO_CLIENT_ID, QBO_CLIENT_SECRET,
 *      QBO_REFRESH_TOKEN, QBO_REALM_ID)
 *
 * Actions: push_invoice | pull_invoices | push_payment | get_rate | refresh_token
 */

const QBO_BASE_URL = 'https://quickbooks.api.intuit.com';
const QBO_AUTH_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const FALLBACK_UGX_USD = 3700;

async function refreshQboToken(clientId, clientSecret, refreshToken) {
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('QuickBooks credentials not configured. Provide Client ID, Client Secret, and Refresh Token in IntegrationConfig or environment secrets.');
  }
  const credentials = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch(QBO_AUTH_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`QBO token refresh failed (${res.status}): ${txt}`);
  }
  return res.json(); // { access_token, refresh_token, expires_in, ... }
}

async function qboRequest(accessToken, realmId, method, path, body = null) {
  const res = await fetch(`${QBO_BASE_URL}/v3/company/${realmId}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`QBO API error ${res.status}: ${err}`);
  }
  return res.json();
}

async function getLiveUgxRate() {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      const rate = data?.rates?.UGX;
      if (rate && rate > 1000) return rate;
    }
  } catch { /* fall through */ }
  return FALLBACK_UGX_USD;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !['admin', 'super_admin'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { action, invoice_id, payment_data } = body;

    // --- Resolve credentials from IntegrationConfig DB → env secrets fallback ---
    let clientId, clientSecret, storedRefreshToken, storedAccessToken, tokenExpiresAt, realmId;
    let configRecord = null;

    const configs = await base44.asServiceRole.entities.IntegrationConfig.filter({ integration_id: 'quickbooks' });
    configRecord = configs?.[0] || null;

    if (configRecord) {
      clientId = configRecord.api_key || null;
      clientSecret = configRecord.api_secret || null;
      storedRefreshToken = configRecord.refresh_token || null;
      storedAccessToken = configRecord.access_token || null;
      tokenExpiresAt = configRecord.token_expires_at || null;
      realmId = configRecord.settings?.realm_id || null;
    }

    // Env secret fallbacks
    if (!clientId) clientId = Deno.env.get('QBO_CLIENT_ID') || null;
    if (!clientSecret) clientSecret = Deno.env.get('QBO_CLIENT_SECRET') || null;
    if (!storedRefreshToken) storedRefreshToken = Deno.env.get('QBO_REFRESH_TOKEN') || null;
    if (!realmId) realmId = Deno.env.get('QBO_REALM_ID') || null;

    if (!realmId) {
      return Response.json({
        error: 'QuickBooks Realm ID not configured. Set settings.realm_id in IntegrationConfig or QBO_REALM_ID secret.',
        provisioned: true,
      }, { status: 503 });
    }

    // --- Determine if we need a fresh access token ---
    let accessToken = storedAccessToken;
    const now = Date.now();
    const expired = !tokenExpiresAt || new Date(tokenExpiresAt).getTime() - now < 60_000; // refresh 1 min before expiry

    if (!accessToken || expired) {
      const tokenData = await refreshQboToken(clientId, clientSecret, storedRefreshToken);
      accessToken = tokenData.access_token;
      const newExpiry = new Date(now + tokenData.expires_in * 1000).toISOString();

      // Persist refreshed tokens back to IntegrationConfig
      if (configRecord) {
        await base44.asServiceRole.entities.IntegrationConfig.update(configRecord.id, {
          access_token: tokenData.access_token,
          token_expires_at: newExpiry,
          // If QB returned a new refresh token (rolling token), persist it
          ...(tokenData.refresh_token ? { refresh_token: tokenData.refresh_token } : {}),
          status: 'healthy',
          last_error: null,
          last_successful_sync_at: new Date().toISOString(),
        });
      }
    }

    // --- Handle "refresh_token" action: just test connectivity and return ---
    if (action === 'refresh_token') {
      return Response.json({ success: true, message: 'QuickBooks token refreshed successfully.' });
    }

    const ugxToUsd = await getLiveUgxRate();

    // --- push_invoice ---
    if (action === 'push_invoice') {
      const invoices = await base44.asServiceRole.entities.Invoice.filter({ id: invoice_id });
      const invoice = invoices?.[0];
      if (!invoice) return Response.json({ error: 'Invoice not found' }, { status: 404 });

      const customers = await base44.asServiceRole.entities.Customer.filter({ id: invoice.customer_id });
      const customer = customers?.[0];

      const qboInvoice = {
        DocNumber: invoice.invoice_number,
        TxnDate: invoice.issue_date,
        DueDate: invoice.due_date,
        CustomerRef: { name: customer?.full_name || 'Unknown Customer' },
        Line: (invoice.items || []).map((item, i) => ({
          Id: String(i + 1),
          LineNum: i + 1,
          Amount: parseFloat(((item.total_ugx || 0) / ugxToUsd).toFixed(2)),
          DetailType: 'SalesItemLineDetail',
          SalesItemLineDetail: {
            ItemRef: { value: '1', name: item.description },
            Qty: item.quantity || 1,
            UnitPrice: parseFloat(((item.unit_price_ugx || 0) / ugxToUsd).toFixed(2)),
          },
        })),
      };

      const result = await qboRequest(accessToken, realmId, 'POST', '/invoice', { Invoice: qboInvoice });
      if (configRecord) {
        await base44.asServiceRole.entities.IntegrationConfig.update(configRecord.id, {
          last_successful_sync_at: new Date().toISOString(),
          last_error: null,
        });
      }
      return Response.json({ success: true, qbo_invoice_id: result.Invoice?.Id, rate_used: ugxToUsd });
    }

    // --- pull_invoices ---
    if (action === 'pull_invoices') {
      const query = encodeURIComponent("SELECT * FROM Invoice WHERE TxnDate > '2026-01-01' MAXRESULTS 100");
      const result = await qboRequest(accessToken, realmId, 'GET', `/query?query=${query}`);
      return Response.json({ success: true, invoices: result.QueryResponse?.Invoice || [] });
    }

    // --- push_payment ---
    if (action === 'push_payment') {
      const { amount, invoice_qbo_id, payment_date } = payment_data || {};
      const qboPayment = {
        TotalAmt: parseFloat((amount / ugxToUsd).toFixed(2)),
        TxnDate: payment_date || new Date().toISOString().slice(0, 10),
        LinkedTxn: [{ TxnId: invoice_qbo_id, TxnType: 'Invoice' }],
      };
      const result = await qboRequest(accessToken, realmId, 'POST', '/payment', { Payment: qboPayment });
      return Response.json({ success: true, qbo_payment_id: result.Payment?.Id, rate_used: ugxToUsd });
    }

    // --- get_rate ---
    if (action === 'get_rate') {
      return Response.json({ success: true, ugx_usd_rate: ugxToUsd });
    }

    return Response.json({ error: 'Unknown action. Use: push_invoice, pull_invoices, push_payment, get_rate, refresh_token' }, { status: 400 });

  } catch (error) {
    // Persist error to IntegrationConfig
    try {
      const base44 = createClientFromRequest(req);
      const configs = await base44.asServiceRole.entities.IntegrationConfig.filter({ integration_id: 'quickbooks' });
      if (configs?.[0]) {
        await base44.asServiceRole.entities.IntegrationConfig.update(configs[0].id, {
          status: 'error',
          last_error: error.message,
        });
      }
    } catch { /* ignore secondary failure */ }
    return Response.json({ error: error.message }, { status: 500 });
  }
});