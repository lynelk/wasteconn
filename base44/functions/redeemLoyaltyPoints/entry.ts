import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Loyalty points redemption. Two modes:
//   1. Catalog reward:  { customer_id, reward_id, reference }
//      Spends the reward's cost_points; wallet_credit rewards top up the wallet
//      by value_ugx, other reward types issue a voucher/perk notification.
//   2. Ad-hoc credit:   { customer_id, points, reference }
//      Converts points to wallet credit at the tenant's configured rate.
//
// Debits the loyalty ledger and (for wallet credit) credits the wallet ledger,
// both via the ledger-backed functions (concurrency-safe) and idempotent on a
// shared redeem reference. lifetime_points (tier) is unaffected because
// loyaltyAward derives lifetime from positive awards only.
//
// Auth: the customer may redeem their own points; staff may act for anyone.

const DEFAULT_UGX_PER_POINT = 10;
const DEFAULT_MIN_REDEEM = 100;
const PAGE = 1000;
const SAFETY_CAP = 50_000;
const STAFF_ROLES = new Set(['admin', 'super_admin', 'dispatcher', 'agent']);

async function redeemablePoints(base44, customerId: string): Promise<number> {
  let net = 0;
  for (let skip = 0; skip < SAFETY_CAP; skip += PAGE) {
    const batch = await base44.asServiceRole.entities.LoyaltyLedgerEntry.filter({ customer_id: customerId }, '-created_date', PAGE, skip);
    if (!batch?.length) break;
    for (const e of batch) net += (e.points || 0);
    if (batch.length < PAGE) break;
  }
  return net;
}

function voucherCode(): string {
  // UUID-based, unguessable token.
  return `VCHR-${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const customerId = body.customer_id;
    const rewardId = body.reward_id ? String(body.reward_id) : null;
    const reference = body.reference ? String(body.reference) : null;

    if (!customerId) return Response.json({ error: 'customer_id required' }, { status: 400 });
    if (!reference) return Response.json({ error: 'reference required for idempotency' }, { status: 400 });

    const customer = await base44.asServiceRole.entities.Customer.get(customerId);
    if (!customer) return Response.json({ error: 'Customer not found' }, { status: 404 });

    // Authorisation.
    const isStaff = STAFF_ROLES.has(user.role);
    const ownsAccount = customer.user_id === user.id || (!!customer.email && customer.email === user.email);
    const crossTenant = user.role !== 'super_admin' && user.tenant_id && customer.tenant_id !== user.tenant_id;
    if ((!isStaff && !ownsAccount) || crossTenant) {
      return Response.json({ error: 'Not authorised to redeem for this customer' }, { status: 403 });
    }

    const redeemKey = `redeem:${reference}`;

    // Idempotency: if this redemption was already applied, return the same
    // response shape the original call produced (re-derived from the ledgers).
    const existing = await base44.asServiceRole.entities.LoyaltyLedgerEntry.filter({ customer_id: customerId, reference: redeemKey });
    if (existing?.[0]) {
      const redeemed = Math.abs(existing[0].points || 0);
      const remaining = await redeemablePoints(base44, customerId);
      const walletEntry = (await base44.asServiceRole.entities.WalletLedgerEntry.filter({ customer_id: customerId, reference: redeemKey }))?.[0];
      const creditedUgx = walletEntry?.amount_ugx || 0;
      return Response.json({
        success: true,
        idempotent: true,
        redeemed_points: redeemed,
        credited_ugx: creditedUgx,
        points_remaining: remaining,
        message: 'This redemption was already processed.',
      });
    }

    // Tenant-configurable rate / minimum.
    const tenant = customer.tenant_id ? await base44.asServiceRole.entities.Tenant.get(customer.tenant_id).catch(() => null) : null;
    const ugxPerPoint = tenant?.loyalty_ugx_per_point ?? DEFAULT_UGX_PER_POINT;
    const minRedeem = tenant?.loyalty_min_redeem_points ?? DEFAULT_MIN_REDEEM;

    const available = await redeemablePoints(base44, customerId);

    // ── Mode 1: catalog reward ──────────────────────────────────────────────
    if (rewardId) {
      const reward = await base44.asServiceRole.entities.LoyaltyReward.get(rewardId).catch(() => null);
      if (!reward || reward.active === false) return Response.json({ error: 'Reward not available' }, { status: 404 });
      if (reward.tenant_id && reward.tenant_id !== customer.tenant_id) return Response.json({ error: 'Reward not available for this customer' }, { status: 403 });
      const cost = Math.floor(reward.cost_points || 0);
      if (cost <= 0) return Response.json({ error: 'Reward is misconfigured (no cost)' }, { status: 400 });
      if (typeof reward.stock === 'number' && reward.stock <= 0) return Response.json({ error: 'Reward is out of stock' }, { status: 409 });
      if (available < cost) return Response.json({ error: `Insufficient points: ${available} available, ${cost} required` }, { status: 400 });

      await base44.asServiceRole.functions.invoke('loyaltyAward', {
        _internal: true,
        customer_id: customerId,
        tenant_id: customer.tenant_id,
        points: -cost,
        reason: `redemption:reward:${reward.id}`,
        reference: redeemKey,
      });

      let creditedUgx = 0;
      let voucher: string | null = null;
      if (reward.reward_type === 'wallet_credit') {
        creditedUgx = reward.value_ugx || 0;
        await base44.asServiceRole.functions.invoke('walletAdjust', {
          _internal: true,
          customer_id: customerId,
          tenant_id: customer.tenant_id,
          amount_ugx: creditedUgx,
          kind: 'adjustment',
          reference: redeemKey,
          note: `Reward redeemed: ${reward.name}`,
        });
      } else {
        // Perk / voucher / discount — issue a code via an in-app notification.
        voucher = voucherCode();
        await base44.asServiceRole.entities.Notification.create({
          tenant_id: customer.tenant_id,
          customer_id: customerId,
          channel: 'in_app',
          template_type: 'custom',
          subject: `Reward redeemed: ${reward.name}`,
          body: `You redeemed "${reward.name}" for ${cost} points. Voucher code: ${voucher}. Present this code to claim your reward.`,
          status: 'sent',
          sent_at: new Date().toISOString(),
          related_entity_type: 'LoyaltyReward',
          related_entity_id: reward.id,
        }).catch(() => null);
      }

      // Best-effort stock decrement for limited rewards.
      if (typeof reward.stock === 'number') {
        await base44.asServiceRole.entities.LoyaltyReward.update(reward.id, { stock: Math.max(0, reward.stock - 1) }).catch(() => null);
      }

      return Response.json({
        success: true,
        reward_id: reward.id,
        reward_name: reward.name,
        redeemed_points: cost,
        credited_ugx: creditedUgx,
        voucher_code: voucher,
        points_remaining: available - cost,
        message: reward.reward_type === 'wallet_credit'
          ? `Redeemed ${reward.name} for ${creditedUgx.toLocaleString()} UGX wallet credit.`
          : `Redeemed ${reward.name}. Voucher: ${voucher}.`,
      });
    }

    // ── Mode 2: ad-hoc points → wallet credit ───────────────────────────────
    const points = Math.floor(Number(body.points));
    if (!Number.isFinite(points) || points <= 0) return Response.json({ error: 'points must be a positive number' }, { status: 400 });
    if (points < minRedeem) return Response.json({ error: `Minimum redemption is ${minRedeem} points` }, { status: 400 });
    if (available < points) return Response.json({ error: `Insufficient points: ${available} available, ${points} requested` }, { status: 400 });

    const creditUgx = points * ugxPerPoint;

    const loyaltyRes = await base44.asServiceRole.functions.invoke('loyaltyAward', {
      _internal: true,
      customer_id: customerId,
      tenant_id: customer.tenant_id,
      points: -points,
      reason: 'redemption',
      reference: redeemKey,
    });
    const walletRes = await base44.asServiceRole.functions.invoke('walletAdjust', {
      _internal: true,
      customer_id: customerId,
      tenant_id: customer.tenant_id,
      amount_ugx: creditUgx,
      kind: 'adjustment',
      reference: redeemKey,
      note: `Redeemed ${points} loyalty points`,
    });

    return Response.json({
      success: true,
      redeemed_points: points,
      credited_ugx: creditUgx,
      points_remaining: loyaltyRes?.data?.points ?? loyaltyRes?.points ?? (available - points),
      wallet_balance_ugx: walletRes?.data?.balance_ugx ?? walletRes?.balance_ugx,
      message: `Redeemed ${points} points for ${creditUgx.toLocaleString()} UGX wallet credit.`,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
