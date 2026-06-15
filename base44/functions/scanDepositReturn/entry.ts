import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Deposit Return Scheme (DRS) "scan to earn".
// A customer scans eligible recyclable items; each maps to a DepositItem with a
// refund value, loyalty points and unit weight. We record a single
// WasteBankTransaction (payout, credited to the wallet), top up the
// CustomerWallet and LoyaltyAccount, and return a redemption summary.
//
// Payload: { customer_id, items: [{ barcode, quantity }] }  (or a single { barcode, quantity })

// Mirror the platform loyalty thresholds used by onPickupCompleted /
// paymentWebhookHandler so a deposit return never demotes a customer.
const TIER_THRESHOLDS: Array<{ tier: string; min: number }> = [
  { tier: 'platinum', min: 5_000 },
  { tier: 'gold', min: 2_000 },
  { tier: 'silver', min: 500 },
  { tier: 'bronze', min: 0 },
];

function tierFor(lifetimePoints: number): string {
  return TIER_THRESHOLDS.find((t) => lifetimePoints >= t.min)?.tier || 'bronze';
}

// Staff roles allowed to process a redemption on behalf of any customer.
const STAFF_ROLES = new Set(['admin', 'super_admin', 'dispatcher', 'agent']);

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const customerId = body.customer_id;
    if (!customerId) return Response.json({ error: 'customer_id required' }, { status: 400 });

    const items = Array.isArray(body.items)
      ? body.items
      : body.barcode ? [{ barcode: body.barcode, quantity: body.quantity || 1 }] : [];
    if (!items.length) return Response.json({ error: 'No items supplied' }, { status: 400 });

    const customer = await base44.asServiceRole.entities.Customer.get(customerId);
    if (!customer) return Response.json({ error: 'Customer not found' }, { status: 404 });
    const tenantId = customer.tenant_id;

    // Authorisation: a customer may only redeem into their own wallet; staff may
    // act on anyone's behalf but not across tenants (super_admin excepted).
    const isStaff = STAFF_ROLES.has(user.role);
    const ownsAccount = customer.user_id === user.id || (!!customer.email && customer.email === user.email);
    const crossTenant = user.role !== 'super_admin' && user.tenant_id && customer.tenant_id !== user.tenant_id;
    if ((!isStaff && !ownsAccount) || crossTenant) {
      return Response.json({ error: 'Not authorised to redeem for this customer' }, { status: 403 });
    }

    let totalValue = 0;
    let totalPoints = 0;
    let totalWeightKg = 0;
    let accepted = 0;
    let rejected = 0;
    const categoryTally: Record<string, number> = {};

    for (const line of items) {
      const qty = Math.max(1, Math.floor(line.quantity || 1));
      // Scope the catalog lookup to the customer's tenant so a barcode shared
      // across tenants can't pay out another operator's deposit value.
      const matches = await base44.asServiceRole.entities.DepositItem.filter({ tenant_id: tenantId, barcode: line.barcode, active: true });
      const item = matches?.[0];
      if (!item) { rejected += qty; continue; }
      accepted += qty;
      totalValue += (item.deposit_value_ugx || 0) * qty;
      totalPoints += (item.loyalty_points || 0) * qty;
      totalWeightKg += (item.unit_weight_kg || 0) * qty;
      const category = item.waste_category || 'mixed';
      categoryTally[category] = (categoryTally[category] || 0) + qty;
    }

    if (accepted === 0) {
      return Response.json({ success: false, accepted: 0, rejected, message: 'No eligible deposit items recognised.' });
    }

    const dominantCategory = Object.entries(categoryTally).sort((a, b) => b[1] - a[1])[0]?.[0] || 'mixed';
    const txnNumber = `DRS-${Date.now().toString(36).toUpperCase()}`;

    const txn = await base44.asServiceRole.entities.WasteBankTransaction.create({
      tenant_id: tenantId,
      transaction_number: txnNumber,
      transaction_type: 'payout',
      customer_id: customerId,
      waste_category: dominantCategory,
      grade: 'A',
      weight_kg: Math.round(totalWeightKg * 1000) / 1000,
      gross_amount_ugx: totalValue,
      net_amount_ugx: totalValue,
      payment_method: 'wallet_credit',
      payment_status: 'completed',
      receipt_number: txnNumber,
      notes: `Deposit return: ${accepted} item(s) scanned, ${rejected} rejected.`,
    });

    // Credit (or open) the customer wallet.
    const wallets = await base44.asServiceRole.entities.CustomerWallet.filter({ customer_id: customerId });
    const existingWallet = wallets?.[0];
    let newBalance = totalValue;
    if (existingWallet) {
      newBalance = (existingWallet.balance_ugx || 0) + totalValue;
      await base44.asServiceRole.entities.CustomerWallet.update(existingWallet.id, {
        balance_ugx: newBalance,
        total_earned_ugx: (existingWallet.total_earned_ugx || 0) + totalValue,
        last_transaction_at: new Date().toISOString(),
      });
    } else {
      await base44.asServiceRole.entities.CustomerWallet.create({
        tenant_id: tenantId,
        customer_id: customerId,
        balance_ugx: totalValue,
        total_earned_ugx: totalValue,
        last_transaction_at: new Date().toISOString(),
      });
    }

    // Award loyalty points and re-evaluate tier.
    const loyalty = (await base44.asServiceRole.entities.LoyaltyAccount.filter({ customer_id: customerId }))?.[0];
    if (loyalty) {
      const lifetime = (loyalty.lifetime_points || 0) + totalPoints;
      await base44.asServiceRole.entities.LoyaltyAccount.update(loyalty.id, {
        points: (loyalty.points || 0) + totalPoints,
        lifetime_points: lifetime,
        tier: tierFor(lifetime),
        last_earned_at: new Date().toISOString(),
      });
    } else if (totalPoints > 0) {
      await base44.asServiceRole.entities.LoyaltyAccount.create({
        tenant_id: tenantId,
        customer_id: customerId,
        points: totalPoints,
        lifetime_points: totalPoints,
        tier: tierFor(totalPoints),
        last_earned_at: new Date().toISOString(),
      });
    }

    return Response.json({
      success: true,
      transaction_id: txn.id,
      transaction_number: txnNumber,
      accepted,
      rejected,
      credited_ugx: totalValue,
      points_awarded: totalPoints,
      weight_kg: Math.round(totalWeightKg * 1000) / 1000,
      wallet_balance_ugx: newBalance,
      message: `Credited ${totalValue.toLocaleString()} UGX to your wallet for ${accepted} item(s).`,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
