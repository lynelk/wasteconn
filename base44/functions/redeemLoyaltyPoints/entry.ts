import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Loyalty points redemption — converts redeemable points into wallet credit.
// Debits the loyalty ledger and credits the wallet ledger, both via the
// ledger-backed functions (concurrency-safe) and idempotent on a shared
// redemption reference. lifetime_points (and therefore tier) is unaffected,
// because loyaltyAward derives lifetime from positive awards only.
//
// Payload: { customer_id, points, reference }
//
// Auth: the customer may redeem their own points; staff may act for anyone.

const UGX_PER_POINT = 10;     // conversion rate: 1 point = 10 UGX wallet credit
const MIN_REDEEM_POINTS = 100; // minimum redeemable in one go
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
    const points = Math.floor(Number(body.points));
    const reference = body.reference ? String(body.reference) : null;

    if (!customerId) return Response.json({ error: 'customer_id required' }, { status: 400 });
    if (!Number.isFinite(points) || points <= 0) return Response.json({ error: 'points must be a positive number' }, { status: 400 });
    if (points < MIN_REDEEM_POINTS) return Response.json({ error: `Minimum redemption is ${MIN_REDEEM_POINTS} points` }, { status: 400 });
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

    // Idempotency: if this redemption was already applied, return current state.
    const existing = await base44.asServiceRole.entities.LoyaltyLedgerEntry.filter({ customer_id: customerId, reference: redeemKey });
    if (existing?.[0]) {
      return Response.json({ success: true, idempotent: true, redeemed_points: points, credited_ugx: points * UGX_PER_POINT });
    }

    // Ensure sufficient balance.
    const available = await redeemablePoints(base44, customerId);
    if (available < points) {
      return Response.json({ error: `Insufficient points: ${available} available, ${points} requested` }, { status: 400 });
    }

    const creditUgx = points * UGX_PER_POINT;

    // Debit loyalty first (so we never over-credit), then credit the wallet.
    // Both are idempotent on redeemKey, so a retry after a partial failure is safe.
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
