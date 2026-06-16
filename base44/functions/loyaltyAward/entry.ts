import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Single entry point for loyalty point movements.
//
// Like walletAdjust, this replaces read-modify-write on LoyaltyAccount (which
// could lose concurrent awards) with an append-only LoyaltyLedgerEntry and a
// recompute of the cached LoyaltyAccount from the ledger sum. Points only
// accrue today (no redemption path), so redeemable points == lifetime points.
//
// Payload: { customer_id, tenant_id?, points, reason?, reference? }
//   reference  idempotency key — a repeated (customer_id, reference) is a no-op
//
// Auth: internal (_internal) or authenticated.

const PAGE = 1000;
const SAFETY_CAP = 50_000;

function tierFor(lifetimePoints: number): string {
  if (lifetimePoints >= 5000) return 'platinum';
  if (lifetimePoints >= 2000) return 'gold';
  if (lifetimePoints >= 500) return 'silver';
  return 'bronze';
}

async function loadAllEntries(base44, customerId: string) {
  const all: Array<{ points?: number; reference?: string }> = [];
  for (let skip = 0; skip < SAFETY_CAP; skip += PAGE) {
    const batch = await base44.asServiceRole.entities.LoyaltyLedgerEntry.filter({ customer_id: customerId }, '-created_date', PAGE, skip);
    if (!batch?.length) break;
    all.push(...batch);
    if (batch.length < PAGE) break;
  }
  return all;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    if (!body._internal) {
      const user = await base44.auth.me().catch(() => null);
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const customerId = body.customer_id;
    const points = Number(body.points);
    if (!customerId) return Response.json({ error: 'customer_id required' }, { status: 400 });
    if (!Number.isFinite(points) || points === 0) return Response.json({ error: 'points must be a non-zero number' }, { status: 400 });

    const reference = body.reference ? String(body.reference) : null;

    const accounts = await base44.asServiceRole.entities.LoyaltyAccount.filter({ customer_id: customerId });
    let account = accounts?.[0] || null;
    let tenantId = body.tenant_id || account?.tenant_id;
    if (!tenantId) {
      const customer = await base44.asServiceRole.entities.Customer.get(customerId).catch(() => null);
      tenantId = customer?.tenant_id;
    }

    let entries = await loadAllEntries(base44, customerId);

    if (reference && entries.some((e) => e.reference === reference)) {
      const lifetime = entries.reduce((s, e) => s + (e.points || 0), 0);
      return Response.json({ success: true, idempotent: true, lifetime_points: lifetime, tier: tierFor(lifetime) });
    }

    // Seed legacy lifetime points so existing balances aren't lost.
    if (entries.length === 0 && account && (account.lifetime_points || 0) !== 0) {
      await base44.asServiceRole.entities.LoyaltyLedgerEntry.create({
        tenant_id: tenantId,
        customer_id: customerId,
        points: account.lifetime_points || 0,
        reason: 'opening',
        reference: 'opening',
      });
    }

    await base44.asServiceRole.entities.LoyaltyLedgerEntry.create({
      tenant_id: tenantId,
      customer_id: customerId,
      points,
      reason: body.reason || 'award',
      reference: reference || undefined,
    });

    entries = await loadAllEntries(base44, customerId);
    const lifetime = entries.reduce((s, e) => s + (e.points || 0), 0);
    const tier = tierFor(lifetime);
    const now = new Date().toISOString();

    if (account) {
      await base44.asServiceRole.entities.LoyaltyAccount.update(account.id, {
        points: lifetime,
        lifetime_points: lifetime,
        tier,
        last_earned_at: now,
      });
    } else {
      account = await base44.asServiceRole.entities.LoyaltyAccount.create({
        tenant_id: tenantId,
        customer_id: customerId,
        points: lifetime,
        lifetime_points: lifetime,
        tier,
        last_earned_at: now,
      });
    }

    return Response.json({ success: true, lifetime_points: lifetime, tier });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
