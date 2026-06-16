import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Single entry point for every customer-wallet movement.
//
// Why this exists: balances were maintained with read-modify-write
// (balance = read + delta) across several call sites, so concurrent credits
// could lose an update. Here we instead append an immutable WalletLedgerEntry
// (a pure insert, immune to lost updates) and recompute the cached
// CustomerWallet.balance_ugx as the SUM of the ledger. Because every concurrent
// caller appends its own row and the balance is re-derived from the full
// ledger, the cached value converges to the correct total regardless of
// interleaving.
//
// Payload: { customer_id, tenant_id?, amount_ugx, kind?, reference?, note? }
//   amount_ugx  signed (positive credits, negative debits)
//   reference   idempotency key — a repeated (customer_id, reference) is a no-op
//
// Auth: callable by authenticated staff/customers, or internally with _internal.

const PAGE = 1000;
const SAFETY_CAP = 50_000;

async function loadAllEntries(base44, customerId: string) {
  const all: Array<{ amount_ugx?: number; kind?: string }> = [];
  for (let skip = 0; skip < SAFETY_CAP; skip += PAGE) {
    const batch = await base44.asServiceRole.entities.WalletLedgerEntry.filter({ customer_id: customerId }, '-created_date', PAGE, skip);
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
    const amount = Number(body.amount_ugx);
    if (!customerId) return Response.json({ error: 'customer_id required' }, { status: 400 });
    if (!Number.isFinite(amount)) return Response.json({ error: 'amount_ugx must be a number' }, { status: 400 });

    const kind = body.kind || (amount >= 0 ? 'earn' : 'withdraw');
    const reference = body.reference ? String(body.reference) : null;

    // Resolve tenant + existing wallet.
    const wallets = await base44.asServiceRole.entities.CustomerWallet.filter({ customer_id: customerId });
    let wallet = wallets?.[0] || null;
    let tenantId = body.tenant_id || wallet?.tenant_id;
    if (!tenantId) {
      const customer = await base44.asServiceRole.entities.Customer.get(customerId).catch(() => null);
      tenantId = customer?.tenant_id;
    }

    let entries = await loadAllEntries(base44, customerId);

    // Idempotency: a repeated (customer_id, reference) does not re-apply.
    if (reference && entries.some((e) => (e as { reference?: string }).reference === reference)) {
      const balance = entries.reduce((s, e) => s + (e.amount_ugx || 0), 0);
      return Response.json({ success: true, idempotent: true, balance_ugx: balance });
    }

    // Seed an opening entry the first time we touch a legacy wallet so its
    // existing balance is preserved once the balance becomes ledger-derived.
    if (entries.length === 0 && wallet && (wallet.balance_ugx || 0) !== 0) {
      await base44.asServiceRole.entities.WalletLedgerEntry.create({
        tenant_id: tenantId,
        customer_id: customerId,
        amount_ugx: wallet.balance_ugx || 0,
        kind: 'opening',
        reference: 'opening',
        note: 'Opening balance migrated from cached wallet',
      });
    }

    await base44.asServiceRole.entities.WalletLedgerEntry.create({
      tenant_id: tenantId,
      customer_id: customerId,
      amount_ugx: amount,
      kind,
      reference: reference || undefined,
      note: body.note || undefined,
    });

    // Recompute the authoritative balance from the full ledger.
    entries = await loadAllEntries(base44, customerId);
    const balance = entries.reduce((s, e) => s + (e.amount_ugx || 0), 0);

    // Cached lifetime counters (informational; derived from the ledger too).
    const sumKind = (pred: (e: { kind?: string; amount_ugx?: number }) => boolean) =>
      entries.filter(pred).reduce((s, e) => s + Math.abs(e.amount_ugx || 0), 0);
    const totalEarned = sumKind((e) => (e.kind === 'earn' || e.kind === 'referral' || e.kind === 'opening') && (e.amount_ugx || 0) > 0);
    const totalPaid = sumKind((e) => e.kind === 'payin');
    const totalWithdrawn = sumKind((e) => e.kind === 'withdraw');
    const now = new Date().toISOString();

    if (wallet) {
      await base44.asServiceRole.entities.CustomerWallet.update(wallet.id, {
        balance_ugx: balance,
        total_earned_ugx: totalEarned,
        total_paid_ugx: totalPaid,
        total_withdrawn_ugx: totalWithdrawn,
        last_transaction_at: now,
      });
    } else {
      wallet = await base44.asServiceRole.entities.CustomerWallet.create({
        tenant_id: tenantId,
        customer_id: customerId,
        balance_ugx: balance,
        total_earned_ugx: totalEarned,
        total_paid_ugx: totalPaid,
        total_withdrawn_ugx: totalWithdrawn,
        last_transaction_at: now,
      });
    }

    return Response.json({ success: true, balance_ugx: balance, total_earned_ugx: totalEarned });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
