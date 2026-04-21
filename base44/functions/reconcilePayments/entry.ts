import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Gateway Reconciliation
// Compares local Payment records against CitoConnect transaction data.
// Identifies three classes of discrepancy:
//   (a) gateway_only  — transaction in gateway, not in local DB
//   (b) local_only    — payment in local DB, not confirmed by gateway
//   (c) amount_mismatch — amounts differ between gateway and local record
// Stores results in a ReconciliationReport entity.

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

    // Fetch local completed payments in range
    const allPayments = await base44.asServiceRole.entities.Payment.filter({ status: 'completed' });
    const localPayments = allPayments.filter(p => {
      const d = p.payment_date || p.created_date || '';
      return d >= dateFrom && d <= dateTo;
    });

    // Build local index by transaction_ref
    const localByRef: Record<string, any> = {};
    for (const p of localPayments) {
      if (p.transaction_ref) localByRef[p.transaction_ref] = p;
    }

    const discrepancies = [];
    let gatewayTransactions = [];
    let gatewayAvailable = false;

    const apiKey = Deno.env.get('CITOCONNECT_API_KEY');
    if (apiKey && CITO_BASE_URL) {
      try {
        const res = await fetch(`${CITO_BASE_URL}/v1/analytics/transactions?from=${dateFrom}&to=${dateTo}`, {
          headers: { 'Authorization': `Bearer ${apiKey}`, 'X-API-Key': apiKey },
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) {
          const data = await res.json();
          gatewayTransactions = data?.transactions || data?.data || [];
          gatewayAvailable = true;

          // (a) Gateway transactions not in local DB
          for (const gtx of gatewayTransactions) {
            const ref = gtx.transaction_id || gtx.reference || gtx.ref;
            const local = ref ? localByRef[ref] : null;
            if (!local) {
              discrepancies.push({
                type: 'gateway_only',
                severity: 'high',
                description: `Transaction ${ref} found in gateway but not in local database`,
                gateway_ref: ref,
                gateway_amount: gtx.amount,
                local_ref: null,
                local_amount: null,
              });
            } else if (Math.abs((gtx.amount || 0) - (local.amount_ugx || 0)) > 100) {
              // (c) Amount mismatch
              discrepancies.push({
                type: 'amount_mismatch',
                severity: 'medium',
                description: `Amount mismatch for ${ref}: gateway=${gtx.amount} UGX, local=${local.amount_ugx} UGX`,
                gateway_ref: ref,
                gateway_amount: gtx.amount,
                local_ref: ref,
                local_amount: local.amount_ugx,
                payment_id: local.id,
              });
            }
          }
        }
      } catch {}
    }

    // (b) Local payments not confirmed by gateway (only if gateway data available)
    if (gatewayAvailable) {
      const gatewayRefs = new Set(
        gatewayTransactions.map(t => t.transaction_id || t.reference || t.ref).filter(Boolean)
      );
      for (const p of localPayments) {
        if (p.transaction_ref && !gatewayRefs.has(p.transaction_ref)) {
          discrepancies.push({
            type: 'local_only',
            severity: 'medium',
            description: `Local payment ${p.transaction_ref} (UGX ${(p.amount_ugx || 0).toLocaleString()}) not found in gateway records`,
            gateway_ref: null,
            gateway_amount: null,
            local_ref: p.transaction_ref,
            local_amount: p.amount_ugx,
            payment_id: p.id,
            customer_id: p.customer_id,
          });
        }
      }
    }

    const summary = {
      date_from: dateFrom,
      date_to: dateTo,
      local_payment_count: localPayments.length,
      local_total_ugx: localPayments.reduce((s, p) => s + (p.amount_ugx || 0), 0),
      gateway_transaction_count: gatewayTransactions.length,
      discrepancy_count: discrepancies.length,
      high_severity: discrepancies.filter(d => d.severity === 'high').length,
      medium_severity: discrepancies.filter(d => d.severity === 'medium').length,
      gateway_available: gatewayAvailable,
    };

    // Store report
    await base44.asServiceRole.entities.ReconciliationReport.create({
      period_from: dateFrom,
      period_to: dateTo,
      local_count: summary.local_payment_count,
      local_total_ugx: summary.local_total_ugx,
      gateway_count: summary.gateway_transaction_count,
      discrepancy_count: summary.discrepancy_count,
      discrepancies: JSON.stringify(discrepancies.slice(0, 200)),
      status: discrepancies.length === 0 ? 'clean' : 'discrepancies_found',
      run_at: new Date().toISOString(),
    });

    return Response.json({ success: true, summary, discrepancies });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
