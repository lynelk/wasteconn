import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { material, grade, quantity_kg, location_zone_id, available_from } = await req.json();

    if (!material || !quantity_kg) {
      return Response.json({ error: 'material and quantity_kg are required' }, { status: 400 });
    }

    // AI-estimate market price per kg
    let ai_estimated_price_ugx = null;
    try {
      const priceResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are a recycling market analyst in Uganda. Estimate a fair market price per kilogram (in UGX) for the following material.
Material: ${material}
Grade: ${grade || 'B'}
Zone: ${location_zone_id || 'Kampala area'}
Quantity: ${quantity_kg} kg

Return a single JSON object with one field: estimated_price_per_kg (number in UGX). Be realistic for the Ugandan market.`,
        response_json_schema: {
          type: 'object',
          properties: {
            estimated_price_per_kg: { type: 'number' }
          }
        }
      });
      ai_estimated_price_ugx = priceResult?.estimated_price_per_kg || null;
    } catch (_e) {
      // Non-blocking — proceed without price estimate
    }

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(); // 14-day expiry

    const listing = await base44.asServiceRole.entities.MaterialListing.create({
      tenant_id: user.data?.tenant_id || 'default',
      waste_bank_agent_id: user.id,
      material,
      grade: grade || 'B',
      quantity_kg,
      location_zone_id: location_zone_id || null,
      available_from: available_from || now,
      expires_at: expiresAt,
      status: 'available',
      ai_estimated_price_ugx,
    });

    // Notify matching buyers
    const buyers = await base44.asServiceRole.entities.RecyclerBuyer.filter({ status: 'active' });
    const matchingBuyers = buyers.filter(b =>
      b.materials_wanted && b.materials_wanted.includes(material)
    );

    for (const buyer of matchingBuyers) {
      await base44.asServiceRole.entities.Notification.create({
        tenant_id: listing.tenant_id,
        type: 'new_material_listing',
        title: `New ${material} listing available`,
        message: `A new ${grade || 'B'}-grade ${material} listing (${quantity_kg} kg) is available. Est. price: UGX ${ai_estimated_price_ugx?.toLocaleString() || 'TBD'}/kg.`,
        entity_type: 'MaterialListing',
        entity_id: listing.id,
        recipient_id: buyer.id,
        is_read: false,
        created_at: now,
      }).catch(() => {});
    }

    return Response.json({ success: true, listing, buyers_notified: matchingBuyers.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});