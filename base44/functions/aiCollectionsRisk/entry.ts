import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// AI Collections Risk Scoring
// Scores each active customer's payment probability using:
// - Days since last payment
// - Overdue invoice count
// - Payment history (on-time vs late)
// - Customer type weighting
// Returns scored accounts sorted by highest risk first.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !['admin', 'super_admin'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const invoices = await base44.asServiceRole.entities.Invoice.list();
    const customers = await base44.asServiceRole.entities.Customer.filter({ status: 'active' });
    const payments = await base44.asServiceRole.entities.Payment.list();

    const today = new Date();

    const scored = customers.map(customer => {
      const custInvoices = invoices.filter(i => i.customer_id === customer.id);
      const custPayments = payments.filter(p => p.customer_id === customer.id && p.status === 'completed');

      const overdueCount = custInvoices.filter(i => i.status === 'overdue').length;
      const issuedCount = custInvoices.filter(i => i.status === 'issued').length;
      const totalInvoiced = custInvoices.length;
      const paidCount = custInvoices.filter(i => i.status === 'paid').length;

      // Days since last payment
      let daysSinceLastPayment = 999;
      if (custPayments.length > 0) {
        const lastPayment = custPayments.sort((a, b) => new Date(b.payment_date || b.created_date) - new Date(a.payment_date || a.created_date))[0];
        daysSinceLastPayment = Math.floor((today - new Date(lastPayment.payment_date || lastPayment.created_date)) / 86400000);
      }

      // Payment rate
      const paymentRate = totalInvoiced > 0 ? paidCount / totalInvoiced : 0;

      // Outstanding amount
      const outstandingUGX = custInvoices
        .filter(i => ['issued', 'overdue', 'partially_paid'].includes(i.status))
        .reduce((s, i) => s + (i.amount_ugx || 0), 0);

      // Risk scoring: higher = worse
      let riskScore = 0;
      riskScore += overdueCount * 20;
      riskScore += Math.min(40, daysSinceLastPayment / 5);
      riskScore += (1 - paymentRate) * 30;
      if (custPayments.length === 0 && totalInvoiced > 0) riskScore += 10;
      // Customer type modifier
      if (customer.customer_type === 'residential') riskScore *= 1.1;
      if (customer.customer_type === 'industrial') riskScore *= 0.85;

      riskScore = Math.min(100, Math.round(riskScore));

      // Tier assignment
      let tier = 'low';
      let tierAction = 'No action needed';
      if (riskScore >= 70) { tier = 'critical'; tierAction = 'Suspension notice'; }
      else if (riskScore >= 50) { tier = 'high'; tierAction = 'Escalate to collections'; }
      else if (riskScore >= 30) { tier = 'medium'; tierAction = 'Send reminder'; }

      return {
        customer_id: customer.id,
        customer_name: customer.full_name,
        customer_type: customer.customer_type,
        phone: customer.phone,
        risk_score: riskScore,
        tier,
        tier_action: tierAction,
        overdue_count: overdueCount,
        outstanding_ugx: outstandingUGX,
        days_since_payment: daysSinceLastPayment === 999 ? null : daysSinceLastPayment,
        payment_rate: Math.round(paymentRate * 100),
        total_invoiced: totalInvoiced,
      };
    });

    const result = scored
      .filter(s => s.total_invoiced > 0)
      .sort((a, b) => b.risk_score - a.risk_score);

    return Response.json({ success: true, accounts: result, scored_at: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});