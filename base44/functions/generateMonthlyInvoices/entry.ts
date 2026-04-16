import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Generates monthly invoices for all active subscriptions.
// Calculates billing based on ServicePlan billing_model:
//   - flat_fee: base price only
//   - fixed_plus_overage_kg: base price + overage charge for kg over threshold

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !['admin', 'super_admin'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const monthStr = body.month || new Date().toISOString().slice(0, 7); // e.g. "2026-04"
    const [year, month] = monthStr.split('-').map(Number);

    // Period: first to last day of month
    const periodFrom = `${year}-${String(month).padStart(2,'0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const periodTo = `${year}-${String(month).padStart(2,'0')}-${lastDay}`;

    // Fetch all active subscriptions
    const subscriptions = await base44.asServiceRole.entities.Subscription.filter({ status: 'active' });

    let count = 0;
    const errors = [];

    for (const sub of subscriptions) {
      try {
        // Get service plan
        const plans = await base44.asServiceRole.entities.ServicePlan.filter({ id: sub.plan_id });
        const plan = plans?.[0];
        if (!plan) continue;

        // Check if invoice already exists for this period
        const existing = await base44.asServiceRole.entities.Invoice.filter({
          customer_id: sub.customer_id,
          issue_date: periodFrom,
        });
        if (existing?.length > 0) continue;

        // Calculate amount
        let baseAmount = plan.price_ugx || 0;
        const items = [{ description: `${plan.plan_name} - ${periodFrom} to ${periodTo}`, quantity: 1, unit_price_ugx: baseAmount, total_ugx: baseAmount }];

        if (plan.billing_model === 'fixed_plus_overage_kg' && plan.overage_threshold_kg && plan.overage_rate_ugx_per_kg) {
          // Sum actual kg collected for this customer in the period
          const pickups = await base44.asServiceRole.entities.PickupRequest.filter({
            customer_id: sub.customer_id,
            status: 'completed',
          });
          const periodPickups = pickups.filter(p => p.scheduled_date >= periodFrom && p.scheduled_date <= periodTo);
          const totalKg = periodPickups.reduce((s, p) => s + (p.actual_weight_kg || 0), 0);
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
      } catch (e) {
        errors.push({ subscription_id: sub.id, error: e.message });
      }
    }

    return Response.json({ success: true, count, errors });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});