import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['admin', 'super_admin'].includes(user.role)) {
      return Response.json({ error: 'Forbidden: Admin role required' }, { status: 403 });
    }

    const { offer_id } = await req.json();
    if (!offer_id) return Response.json({ error: 'offer_id is required' }, { status: 400 });

    const offer = await base44.asServiceRole.entities.RecyclerOffer.get(offer_id);
    if (!offer) return Response.json({ error: 'Offer not found' }, { status: 404 });
    if (offer.status !== 'accepted') {
      return Response.json({ error: 'Only accepted offers can be settled' }, { status: 409 });
    }

    const now = new Date().toISOString();
    const settlementAmount = (offer.offered_price_per_kg_ugx || 0) * (offer.quantity_kg || 0);

    await base44.asServiceRole.entities.RecyclerOffer.update(offer_id, {
      status: 'completed',
      settlement_ugx: settlementAmount,
      settled_at: now,
    });

    await base44.asServiceRole.entities.MaterialListing.update(offer.listing_id, { status: 'sold' });

    // Create WasteBankTransaction payin record for settlement
    await base44.asServiceRole.entities.WasteBankTransaction.create({
      tenant_id: offer.tenant_id,
      transaction_type: 'payin',
      amount_ugx: settlementAmount,
      source: 'recycler_marketplace',
      reference_id: offer_id,
      description: `Recycler marketplace settlement for offer ${offer_id}`,
      recorded_at: now,
      status: 'completed',
    }).catch(() => {});

    return Response.json({ success: true, settlement_ugx: settlementAmount, offer_id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});