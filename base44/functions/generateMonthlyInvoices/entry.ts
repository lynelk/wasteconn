import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Generates monthly invoices for all active subscriptions.
// Calculates billing based on ServicePlan billing_model:
//   - flat_fee: base price only
//   - fixed_plus_overage_kg: base price + overage charge for kg over threshold

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user && !['admin', 'super_admin'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const monthStr = body.month || new Date().toISOString().slice(0, 7); // e.g. "2026-04"
    const [year, month] = monthStr.split('-').map(Number);

    // Period: first to last day of month
    const periodFrom = `${year}-${String(month).padStart(2,'0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const periodTo = `${year}-${String(month).padStart(2,'0')}-${lastDay}`;

    // Fetch all active subscriptions and plans in parallel (avoid N+1 per subscription)
    const [subscriptions, allPlans] = await Promise.all([
      base44.asServiceRole.entities.Subscription.filter({ status: 'active' }),
      base44.asServiceRole.entities.ServicePlan.filter({}),
    ]);
    const planMap = new Map(allPlans.map(p => [p.id, p]));

    // Batch-fetch existing invoices and completed pickups for the period to avoid N+1 queries
    const [existingInvoices, periodPickupsAll] = await Promise.all([
      base44.asServiceRole.entities.Invoice.filter({ issue_date: periodFrom }),
      base44.asServiceRole.entities.PickupRequest.filter({ status: 'completed' }),
    ]);
    const invoicedCustomerIds = new Set(existingInvoices.map(inv => inv.customer_id));
    const pickupsByCustomer = new Map();
    for (const p of periodPickupsAll) {
      if (p.scheduled_date >= periodFrom && p.scheduled_date <= periodTo) {
        if (!pickupsByCustomer.has(p.customer_id)) pickupsByCustomer.set(p.customer_id, []);
        pickupsByCustomer.get(p.customer_id).push(p);
      }
    }

    let count = 0;
    const errors = [];

    for (const sub of subscriptions) {
      try {
        // Look up plan from cached map
        const plan = planMap.get(sub.plan_id);
        if (!plan) continue;

        // Check if invoice already exists for this period (from cached set)
        if (invoicedCustomerIds.has(sub.customer_id)) continue;

        // Calculate amount
        let baseAmount = plan.price_ugx || 0;
        const items = [{ description: `${plan.plan_name} - ${periodFrom} to ${periodTo}`, quantity: 1, unit_price_ugx: baseAmount, total_ugx: baseAmount }];

        if (plan.billing_model === 'fixed_plus_overage_kg' && plan.overage_threshold_kg && plan.overage_rate_ugx_per_kg) {
          // Sum actual kg collected for this customer in the period (from cached map)
          const customerPickups = pickupsByCustomer.get(sub.customer_id) || [];
          const totalKg = customerPickups.reduce((s, p) => s + (p.actual_weight_kg || 0), 0);
          const overageKg = Math.max(0, totalKg - plan.overage_threshold_kg);
          if (overageKg > 0) {
            const overageAmount = Math.round(overageKg * plan.overage_rate_ugx_per_kg);
            items.push({ description: `Overage: ${overageKg.toFixed(1)} kg × ${plan.overage_rate_ugx_per_kg} UGX/kg`, quantity: overageKg, unit_price_ugx: plan.overage_rate_ugx_per_kg, total_ugx: overageAmount });
            baseAmount += overageAmount;
          }
        }

        // Calculate due date
        const dueDays = plan.invoice_due_days ?? 0;
        const dueDate = dueDays === 0
          ? periodTo
          : new Date(new Date(periodTo).getTime() + dueDays * 86400000).toISOString().slice(0, 10);

        // Generate invoice number
        const invoiceNumber = `INV-${year}${String(month).padStart(2,'0')}-${sub.customer_id.slice(0,6).toUpperCase()}`;

        await base44.asServiceRole.entities.Invoice.create({
          tenant_id: sub.tenant_id,
          customer_id: sub.customer_id,
          subscription_id: sub.id,
          invoice_number: invoiceNumber,
          amount_ugx: baseAmount,
          status: 'issued',
          issue_date: periodFrom,
          due_date: dueDate,
          items,
        });
        count++;
        // Throttle creates to avoid entity rate limiting on bulk invoice generation
        if (count % 10 === 0) await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        errors.push({ subscription_id: sub.id, error: e.message });
      }
    }

    return Response.json({ success: true, count, errors });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});