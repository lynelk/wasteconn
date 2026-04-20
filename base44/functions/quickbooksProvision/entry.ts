import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// QuickBooks Integration - Provisioned and ready for OAuth connector setup.
// This function handles:
//   - action: "push_invoice"   → Create invoice in QuickBooks
//   - action: "pull_invoices"  → Pull invoices from QuickBooks
//   - action: "push_payment"   → Record payment in QuickBooks
//
// IMPORTANT: Requires QuickBooks Online OAuth credentials to be configured.
// Set the following secrets when ready:
//   - QBO_CLIENT_ID
//   - QBO_CLIENT_SECRET
//   - QBO_REFRESH_TOKEN
//   - QBO_REALM_ID

const QBO_BASE_URL = 'https://quickbooks.api.intuit.com';
const QBO_AUTH_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const FALLBACK_UGX_USD = 3700;

async function refreshQboToken() {
  const clientId = Deno.env.get('QBO_CLIENT_ID');
  const clientSecret = Deno.env.get('QBO_CLIENT_SECRET');
  const refreshToken = Deno.env.get('QBO_REFRESH_TOKEN');

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('QuickBooks credentials not configured. Please set QBO_CLIENT_ID, QBO_CLIENT_SECRET, and QBO_REFRESH_TOKEN secrets.');
  }

  const credentials = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch(QBO_AUTH_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=refresh_token&refresh_token=${refreshToken}`,
  });

  if (!res.ok) throw new Error(`QBO token refresh failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
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

async function getLiveUgxRate(base44): Promise<number> {
  // Try to get a cached rate from system config (valid 24h)
  try {
    const configs = await base44.asServiceRole.entities.SystemConfig.filter({ key: 'ugx_usd_rate' });
    const cached = configs?.[0];
    if (cached && cached.updated_date) {
      const ageHours = (Date.now() - new Date(cached.updated_date).getTime()) / 3600000;
      if (ageHours < 24 && cached.value) return parseFloat(cached.value);
    }
  } catch {}

  // Fetch from ExchangeRate-API (free, no key needed for basic)
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      const rate = data?.rates?.UGX;
      if (rate && rate > 1000) {
        // Cache in SystemConfig
        try {
          const configs = await base44.asServiceRole.entities.SystemConfig.filter({ key: 'ugx_usd_rate' });
          if (configs?.[0]) {
            await base44.asServiceRole.entities.SystemConfig.update(configs[0].id, { value: String(rate) });
          } else {
            await base44.asServiceRole.entities.SystemConfig.create({ key: 'ugx_usd_rate', value: String(rate) });
          }
        } catch {}
        return rate;
      }
    }
  } catch {}

  return FALLBACK_UGX_USD;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !['admin', 'super_admin'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { action, invoice_id, payment_data } = await req.json();
    const realmId = Deno.env.get('QBO_REALM_ID');

    if (!realmId) {
      return Response.json({ error: 'QuickBooks not configured. QBO_REALM_ID secret is missing.', provisioned: true }, { status: 503 });
    }

    const accessToken = await refreshQboToken();
    const ugxToUsd = await getLiveUgxRate(base44);

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
          Amount: (item.total_ugx || 0) / ugxToUsd,
          DetailType: 'SalesItemLineDetail',
          SalesItemLineDetail: {
            ItemRef: { value: '1', name: item.description },
            Qty: item.quantity || 1,
            UnitPrice: (item.unit_price_ugx || 0) / ugxToUsd,
          },
        })),
      };

      const result = await qboRequest(accessToken, realmId, 'POST', '/invoice', { Invoice: qboInvoice });
      return Response.json({ success: true, qbo_invoice_id: result.Invoice?.Id, rate_used: ugxToUsd });
    }

    if (action === 'pull_invoices') {
      const query = encodeURIComponent("SELECT * FROM Invoice WHERE TxnDate > '2026-01-01' MAXRESULTS 100");
      const result = await qboRequest(accessToken, realmId, 'GET', `/query?query=${query}`);
      return Response.json({ success: true, invoices: result.QueryResponse?.Invoice || [] });
    }

    if (action === 'push_payment') {
      const { amount, invoice_qbo_id, payment_date } = payment_data || {};
      const qboPayment = {
        TotalAmt: amount,
        TxnDate: payment_date || new Date().toISOString().slice(0, 10),
        LinkedTxn: [{ TxnId: invoice_qbo_id, TxnType: 'Invoice' }],
      };
      const result = await qboRequest(accessToken, realmId, 'POST', '/payment', { Payment: qboPayment });
      return Response.json({ success: true, qbo_payment_id: result.Payment?.Id });
    }

    if (action === 'get_rate') {
      return Response.json({ success: true, ugx_usd_rate: ugxToUsd });
    }

    return Response.json({ error: 'Unknown action. Use: push_invoice, pull_invoices, push_payment, get_rate' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
