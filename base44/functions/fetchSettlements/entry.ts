import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Fetches settlement data from CitoConnect gateway.
// A settlement is when the gateway actually transfers collected funds to NLSWMS bank account.
// Stores results in Settlement entity for tracking and reconciliation.

const CITO_BASE_URL = (() => {
  const url = Deno.env.get('CITOCONNECT_API_URL') || '';
  return url.startsWith('http') ? url.replace(/\/$/, '') : '';
})();

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !['admin', 'super_admin'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const dateFrom = body.date_from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const dateTo   = body.date_to   || new Date().toISOString().slice(0, 10);

    const apiKey = Deno.env.get('CITOCONNECT_API_KEY');

    // Provisioned mode
    if (!apiKey || !CITO_BASE_URL) {
      return Response.json({
        success: false,
        provisioned: true,
        message: 'CitoConnect not configured. Set CITOCONNECT_API_KEY and CITOCONNECT_API_URL to fetch settlements.',
        settlements: [],
      });
    }

    // Fetch from CitoConnect
    const res = await fetch(`${CITO_BASE_URL}/v1/settlements?from=${dateFrom}&to=${dateTo}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'X-API-Key': apiKey,
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      return Response.json({ error: `CitoConnect settlements fetch failed (${res.status}): ${err}` }, { status: 502 });
    }

    const data = await res.json();
    const settlements = data?.settlements || data?.data || [];

    let saved = 0;
    for (const s of settlements) {
      const ref = s.settlement_id || s.reference || s.id;
      if (!ref) continue;

      // Check if already saved
      const existing = await base44.asServiceRole.entities.Settlement.filter({ gateway_ref: ref });
      if (existing?.length > 0) continue;

      await base44.asServiceRole.entities.Settlement.create({
        gateway: 'citoconnect',
        gateway_ref: ref,
        settlement_date: s.settlement_date || s.date || new Date().toISOString().slice(0, 10),
        amount_ugx: s.amount || s.amount_ugx || 0,
        transaction_count: s.transaction_count || s.count || 0,
        bank_reference: s.bank_reference || s.bank_ref || null,
        status: s.status || 'settled',
        raw: JSON.stringify(s),
        fetched_at: new Date().toISOString(),
      });
      saved++;
    }

    return Response.json({
      success: true,
      settlements_fetched: settlements.length,
      settlements_saved: saved,
      date_from: dateFrom,
      date_to: dateTo,
      settlements,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
