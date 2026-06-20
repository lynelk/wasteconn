import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { offer_id, action } = await req.json();

    if (!offer_id || !['accept', 'reject'].includes(action)) {
      return Response.json({ error: 'offer_id and action (accept|reject) are required' }, { status: 400 });
    }

    const offer = await base44.asServiceRole.entities.RecyclerOffer.get(offer_id);
    if (!offer) return Response.json({ error: 'Offer not found' }, { status: 404 });
    if (offer.status !== 'pending') {
      return Response.json({ error: `Offer is already ${offer.status}` }, { status: 409 });
    }

    if (action === 'accept') {
      await base44.asServiceRole.entities.RecyclerOffer.update(offer_id, { status: 'accepted' });
      await base44.asServiceRole.entities.MaterialListing.update(offer.listing_id, { status: 'reserved' });
      return Response.json({ success: true, status: 'accepted' });
    } else {
      await base44.asServiceRole.entities.RecyclerOffer.update(offer_id, { status: 'rejected' });
      return Response.json({ success: true, status: 'rejected' });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});