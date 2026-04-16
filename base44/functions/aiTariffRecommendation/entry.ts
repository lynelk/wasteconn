import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// AI Tariff Recommendation Engine
// Analyses customer profile signals + historical data to recommend optimal plan
// Also computes churn-risk-adjusted discount signals

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { customer_id } = body;

    if (!customer_id) return Response.json({ error: 'customer_id is required' }, { status: 400 });

    // Fetch customer + plans + their history in parallel
    const [customer, plans, allSubscriptions, allInvoices, allPickups] = await Promise.all([
      base44.asServiceRole.entities.Customer.filter({ id: customer_id }).then(r => r[0]),
      base44.asServiceRole.entities.ServicePlan.filter({ status: 'active' }),
      base44.asServiceRole.entities.Subscription.filter({ customer_id }),
      base44.asServiceRole.entities.Invoice.filter({ customer_id }),
      base44.asServiceRole.entities.PickupRequest.filter({ customer_id }),
    ]);

    if (!customer) return Response.json({ error: 'Customer not found' }, { status: 404 });

    // --- FEATURE EXTRACTION ---
    const segment = customer.customer_segment || 'individual';
    const custType = customer.customer_type || 'residential';
    const binCount = customer.bin_count || 1;
    const estWasteKg = customer.estimated_waste_kg_month || 0;
    const numBranches = customer.num_branches || 1;

    // Payment behaviour
    const paidInvoices = allInvoices.filter(i => i.status === 'paid').length;
    const overdueInvoices = allInvoices.filter(i => i.status === 'overdue').length;
    const totalInvoices = allInvoices.length;
    const paymentScore = totalInvoices > 0 ? (paidInvoices / totalInvoices) * 100 : 50;

    // Usage behaviour
    const completedPickups = allPickups.filter(p => p.status === 'completed').length;
    const cancelledPickups = allPickups.filter(p => p.status === 'cancelled').length;
    const usageRate = allPickups.length > 0 ? (completedPickups / allPickups.length) * 100 : 100;

    // Churn risk signals
    let churnRisk = 0;
    if (overdueInvoices > 2) churnRisk += 30;
    if (cancelledPickups > completedPickups * 0.3) churnRisk += 20;
    if (allSubscriptions.some(s => s.status === 'suspended')) churnRisk += 25;
    if (paymentScore < 60) churnRisk += 25;
    churnRisk = Math.min(100, churnRisk);

    // --- PLAN SCORING ---
    const scoredPlans = plans.map(plan => {
      let score = 0;
      const reasons = [];

      // Type alignment
      if (plan.customer_type === 'all' || plan.customer_type === custType) {
        score += 25;
        reasons.push('Matches customer type');
      }

      // Frequency alignment
      if (segment === 'institution' || custType === 'commercial') {
        if (['daily', 'twice_weekly'].includes(plan.frequency)) { score += 20; reasons.push('High-frequency plan for commercial/institution'); }
      } else if (custType === 'residential') {
        if (['weekly', 'biweekly'].includes(plan.frequency)) { score += 20; reasons.push('Standard frequency for residential'); }
      }

      // Bin count & capacity alignment
      if (plan.max_bins >= binCount) {
        score += 15;
        reasons.push(`Supports ${plan.max_bins} bins`);
      }

      // Weight capacity
      if (plan.billing_model === 'fixed_plus_overage_kg' && estWasteKg > 0) {
        const covered = plan.overage_threshold_kg || 0;
        if (covered >= estWasteKg) { score += 15; reasons.push('Covers estimated waste volume'); }
      } else if (plan.billing_model === 'flat_fee') {
        score += 10;
        reasons.push('Predictable flat fee');
      }

      // Payment score bonus (reliable payers → premium plans)
      if (paymentScore >= 90 && plan.price_ugx > 50000) { score += 10; reasons.push('Reliable payment history'); }

      // Multi-branch bonus
      if (numBranches > 1 && plan.max_bins >= numBranches * binCount) {
        score += 10;
        reasons.push('Covers multi-branch setup');
      }

      // Recycling bonus for eco-conscious
      if (plan.includes_recycling) { score += 5; reasons.push('Includes recycling'); }

      return { plan, score, reasons };
    });

    scoredPlans.sort((a, b) => b.score - a.score);
    const top3 = scoredPlans.slice(0, 3);

    // Churn discount suggestion
    let discountSuggestion = null;
    if (churnRisk >= 50 && allSubscriptions.some(s => s.status === 'active')) {
      const discountPct = churnRisk >= 75 ? 15 : 10;
      discountSuggestion = {
        discount_pct: discountPct,
        reason: `Customer shows ${churnRisk}% churn risk. A ${discountPct}% discount may improve retention.`,
      };
    }

    // Tier classification
    let recommendedTier = 'basic';
    if (segment === 'institution' || numBranches > 3 || estWasteKg > 500) recommendedTier = 'enterprise';
    else if (segment === 'sme' || custType === 'commercial' || estWasteKg > 200) recommendedTier = 'premium';
    else if (binCount > 2 || estWasteKg > 100) recommendedTier = 'standard';

    return Response.json({
      success: true,
      customer_id,
      churn_risk_score: churnRisk,
      recommended_tier: recommendedTier,
      discount_suggestion: discountSuggestion,
      plan_recommendations: top3.map(r => ({
        plan_id: r.plan.id,
        plan_name: r.plan.plan_name,
        price_ugx: r.plan.price_ugx,
        billing_cycle: r.plan.billing_cycle,
        frequency: r.plan.frequency,
        score: r.score,
        reasons: r.reasons,
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});