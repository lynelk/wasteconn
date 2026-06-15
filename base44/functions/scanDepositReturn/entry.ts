import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Deposit Return Scheme (DRS) "scan to earn".
// A customer scans eligible recyclable items; each maps to a DepositItem with a
// refund value, loyalty points and unit weight. We record a single
// WasteBankTransaction (payout, credited to the wallet), top up the
// CustomerWallet and LoyaltyAccount, and return a redemption summary.
//
// Payload: { customer_id, items: [{ barcode, quantity }] }  (or a single { barcode, quantity })

const TIER_THRESHOLDS: Array<{ tier: string; min: number }> = [
  { tier: 'platinum', min: 50_000 },
  { tier: 'gold', min: 20_000 },
  { tier: 'silver', min: 5_000 },
  { tier: 'bronze', min: 0 },
];

function tierFor(lifetimePoints: number): string {
  return TIER_THRESHOLDS.find((t) => lifetimePoints >= t.min)?.tier || 'bronze';
}

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
    if (user.role === 'customer' && customer.user_id && customer.user_id !== user.id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const tenantId = customer.tenant_id;
    let totalValue = 0;
    let totalPoints = 0;
    let totalWeightKg = 0;
    let accepted = 0;
    let rejected = 0;
    const categoryTally: Record<string, number> = {};

    for (const line of items) {
      const qty = Math.max(1, Math.floor(line.quantity || 1));
      const matches = await base44.asServiceRole.entities.DepositItem.filter({ barcode: line.barcode, active: true });
      const item = matches?.[0];
      if (!item) { rejected += qty; continue; }
      accepted += qty;
      totalValue += (item.deposit_value_ugx || 0) * qty;
      totalPoints += (item.loyalty_points || 0) * qty;
      totalWeightKg += (item.unit_weight_kg || 0) * qty;
      const category = item.waste_category || 'mixed';
      categoryTally[category] = (categoryTally[category] || 0) + qty;

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
    let wallet = wallets?.[0];
    if (wallet) {
      const newBalance = (wallet.balance_ugx || 0) + totalValue;
      const newTotalEarned = (wallet.total_earned_ugx || 0) + totalValue;
      await base44.asServiceRole.entities.CustomerWallet.update(wallet.id, {
        balance_ugx: newBalance,
        total_earned_ugx: newTotalEarned,
        last_transaction_at: new Date().toISOString(),
      });
      wallet = { ...wallet, balance_ugx: newBalance, total_earned_ugx: newTotalEarned };
    } else {
      wallet = await base44.asServiceRole.entities.CustomerWallet.create({
        tenant_id: tenantId,
        customer_id: customerId,
        balance_ugx: totalValue,
        total_earned_ugx: totalValue,
        last_transaction_at: new Date().toISOString(),
      });
    }

    // Award loyalty points and re-evaluate tier.
    let loyalty = (await base44.asServiceRole.entities.LoyaltyAccount.filter({ customer_id: customerId }))?.[0];
    if (loyalty) {
      const lifetime = (loyalty.lifetime_points || 0) + totalPoints;
      await base44.asServiceRole.entities.LoyaltyAccount.update(loyalty.id, {
        points: (loyalty.points || 0) + totalPoints,
        lifetime_points: lifetime,
        tier: tierFor(lifetime),
        last_earned_at: new Date().toISOString(),
      });
    } else if (totalPoints > 0) {
      loyalty = await base44.asServiceRole.entities.LoyaltyAccount.create({
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
      wallet_balance_ugx: wallet ? (wallet.balance_ugx ?? totalValue) : totalValue,
      message: `Credited ${totalValue.toLocaleString()} UGX to your wallet for ${accepted} item(s).`,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
