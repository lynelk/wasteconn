import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// AI Payment Fraud Detection
// Uses statistical anomaly scoring on payment patterns.
// Flags transactions with: unusual amounts, off-hours timing,
// mismatched customer history, rapid duplicate amounts.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !['admin', 'super_admin'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const lookbackDays = body.lookback_days || 30;
    const cutoff = new Date(Date.now() - lookbackDays * 86400000).toISOString().slice(0, 10);

    const allPayments = await base44.asServiceRole.entities.Payment.list();
    const recentPayments = allPayments.filter(p => (p.payment_date || p.created_date || '') >= cutoff);

    // Build per-customer baseline stats
    const customerStats = {};
    for (const p of allPayments) {
      if (!customerStats[p.customer_id]) {
        customerStats[p.customer_id] = { amounts: [], count: 0 };
      }
      if (p.amount_ugx) customerStats[p.customer_id].amounts.push(p.amount_ugx);
      customerStats[p.customer_id].count++;
    }

    // Compute means and std devs
    const baseline = {};
    for (const [cid, stats] of Object.entries(customerStats)) {
      const n = stats.amounts.length;
      if (n === 0) continue;
      const mean = stats.amounts.reduce((s, a) => s + a, 0) / n;
      const variance = stats.amounts.reduce((s, a) => s + Math.pow(a - mean, 2), 0) / n;
      baseline[cid] = { mean, std: Math.sqrt(variance), count: n };
    }

    // Global amount stats for new customers
    const globalAmounts = allPayments.map(p => p.amount_ugx).filter(Boolean);
    const globalMean = globalAmounts.length > 0 ? globalAmounts.reduce((s, a) => s + a, 0) / globalAmounts.length : 50000;
    const globalStd = globalAmounts.length > 1
      ? Math.sqrt(globalAmounts.reduce((s, a) => s + Math.pow(a - globalMean, 2), 0) / globalAmounts.length)
      : globalMean * 0.5;

    const flagged = [];

    for (const payment of recentPayments) {
      const anomalies = [];
      let fraudScore = 0;

      // 1. Amount anomaly: Z-score vs customer history
      const stats = baseline[payment.customer_id] || { mean: globalMean, std: globalStd, count: 0 };
      if (payment.amount_ugx && stats.std > 0) {
        const z = Math.abs((payment.amount_ugx - stats.mean) / stats.std);
        if (z > 3) { anomalies.push(`Amount ${(payment.amount_ugx).toLocaleString()} UGX is ${z.toFixed(1)}σ from customer average`); fraudScore += 35; }
        else if (z > 2) { anomalies.push(`Unusual payment amount (${z.toFixed(1)}σ from average)`); fraudScore += 15; }
      }

      // 2. Off-hours payment (before 5am or after 11pm local time)
      const payDate = new Date(payment.created_date);
      const hour = payDate.getUTCHours() + 3; // EAT = UTC+3
      const localHour = hour % 24;
      if (localHour < 5 || localHour >= 23) {
        anomalies.push(`Off-hours transaction at ${localHour}:00 EAT`);
        fraudScore += 20;
      }

      // 3. Duplicate amount detection within 24h for same customer
      const recentSame = recentPayments.filter(p =>
        p.id !== payment.id &&
        p.customer_id === payment.customer_id &&
        p.amount_ugx === payment.amount_ugx &&
        Math.abs(new Date(p.created_date) - new Date(payment.created_date)) < 86400000
      );
      if (recentSame.length > 0) {
        anomalies.push(`Duplicate amount within 24h (${recentSame.length} matching transaction(s))`);
        fraudScore += 25;
      }

      // 4. First-time large payment (no history, large amount)
      if (stats.count === 0 && payment.amount_ugx > globalMean * 3) {
        anomalies.push('Large first-time payment with no prior history');
        fraudScore += 20;
      }

      fraudScore = Math.min(100, fraudScore);

      if (fraudScore >= 20) {
        flagged.push({
          payment_id: payment.id,
          customer_id: payment.customer_id,
          amount_ugx: payment.amount_ugx,
          payment_method: payment.payment_method,
          transaction_ref: payment.transaction_ref,
          payment_date: payment.payment_date || payment.created_date,
          fraud_score: fraudScore,
          anomalies,
          risk_level: fraudScore >= 60 ? 'high' : fraudScore >= 35 ? 'medium' : 'low',
        });
      }
    }

    flagged.sort((a, b) => b.fraud_score - a.fraud_score);

    return Response.json({
      success: true,
      total_analysed: recentPayments.length,
      flagged_count: flagged.length,
      flagged,
      analysed_at: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});