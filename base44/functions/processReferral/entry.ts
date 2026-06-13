import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Referral program. Actions:
//   get_or_create_code { customer_id }       -> returns the customer's referral code
//   redeem            { code, referee_customer_id } -> links a new customer to a referrer
//   reward            { referee_customer_id } -> on referee's first payment, credit referrer's wallet
// The reward action is also invoked internally by paymentWebhookHandler.

const REFERRAL_REWARD_UGX = 5000;

function makeCode(customerId: string): string {
  return `REF-${customerId.slice(0, 6).toUpperCase()}`;
}

async function creditWallet(base44, customerId: string, tenantId: string, amount: number, note: string) {
  const wallets = await base44.asServiceRole.entities.CustomerWallet.filter({ customer_id: customerId });
  const now = new Date().toISOString();
  if (wallets?.length) {
    const w = wallets[0];
    await base44.asServiceRole.entities.CustomerWallet.update(w.id, {
      balance_ugx: (w.balance_ugx || 0) + amount,
      total_earned_ugx: (w.total_earned_ugx || 0) + amount,
      last_transaction_at: now,
    });
  } else {
    await base44.asServiceRole.entities.CustomerWallet.create({
      tenant_id: tenantId,
      customer_id: customerId,
      balance_ugx: amount,
      total_earned_ugx: amount,
      last_transaction_at: now,
    });
  }
  // Ledger entry mirroring WasteBank payout style (credited to wallet, not cashed out)
  await base44.asServiceRole.entities.WasteBankTransaction.create({
    tenant_id: tenantId,
    transaction_type: 'payout',
    customer_id: customerId,
    gross_amount_ugx: amount,
    net_amount_ugx: amount,
    payout_method: 'wallet_credit',
    payment_status: 'completed',
    notes: note,
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // Internal reward calls pass _internal; user actions require auth
    if (!body._internal) {
      const user = await base44.auth.me().catch(() => null);
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (action === 'get_or_create_code') {
      const { customer_id } = body;
      if (!customer_id) return Response.json({ error: 'customer_id required' }, { status: 400 });
      const existing = await base44.asServiceRole.entities.Referral.filter({ referrer_customer_id: customer_id });
      const code = existing?.[0]?.code || makeCode(customer_id);
      return Response.json({ success: true, code });
    }

    if (action === 'redeem') {
      const { code, referee_customer_id } = body;
      if (!code || !referee_customer_id) return Response.json({ error: 'code and referee_customer_id required' }, { status: 400 });

      // Find referrer by code (code is derived from referrer id prefix; match against customers)
      const customers = await base44.asServiceRole.entities.Customer.list();
      const referrer = customers.find(c => makeCode(c.id) === code);
      if (!referrer) return Response.json({ error: 'Invalid referral code' }, { status: 404 });
      if (referrer.id === referee_customer_id) return Response.json({ error: 'Cannot refer yourself' }, { status: 400 });

      // Prevent duplicate redemption by the same referee
      const already = await base44.asServiceRole.entities.Referral.filter({ referee_customer_id });
      if (already?.length) return Response.json({ success: true, duplicate: true, message: 'Referral already recorded' });

      const ref = await base44.asServiceRole.entities.Referral.create({
        tenant_id: referrer.tenant_id,
        referrer_customer_id: referrer.id,
        referee_customer_id,
        code,
        status: 'pending',
        reward_ugx: REFERRAL_REWARD_UGX,
      });
      return Response.json({ success: true, referral_id: ref.id });
    }

    if (action === 'reward') {
      const { referee_customer_id } = body;
      if (!referee_customer_id) return Response.json({ error: 'referee_customer_id required' }, { status: 400 });

      const pending = await base44.asServiceRole.entities.Referral.filter({ referee_customer_id, status: 'pending' });
      if (!pending?.length) return Response.json({ success: true, rewarded: 0 });

      let rewarded = 0;
      for (const ref of pending) {
        await creditWallet(base44, ref.referrer_customer_id, ref.tenant_id, ref.reward_ugx || REFERRAL_REWARD_UGX, `Referral reward for referring customer ${referee_customer_id}`);
        await base44.asServiceRole.entities.Referral.update(ref.id, {
          status: 'rewarded',
          rewarded_at: new Date().toISOString(),
        });
        rewarded++;
      }
      return Response.json({ success: true, rewarded });
    }

    if (action === 'list') {
      const { customer_id } = body;
      const refs = await base44.asServiceRole.entities.Referral.filter({ referrer_customer_id: customer_id });
      return Response.json({ success: true, referrals: refs });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
