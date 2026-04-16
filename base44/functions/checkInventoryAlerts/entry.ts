import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const MERX365_API_URL = Deno.env.get('MERX365_API_URL') || '';
const MERX365_API_KEY = Deno.env.get('MERX365_API_KEY') || '';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow both authenticated calls and scheduled/automation calls
    let callerEmail = 'system';
    try {
      const user = await base44.auth.me();
      if (user) callerEmail = user.email;
    } catch (_) { /* scheduled call, continue */ }

    // Fetch all inventory items
    const items = await base44.asServiceRole.entities.Inventory.list();

    const belowThreshold = items.filter(item =>
      item.current_stock <= item.safety_threshold && item.po_status !== 'pending' && item.po_status !== 'submitted'
    );

    const results = [];

    for (const item of belowThreshold) {
      const poPayload = {
        sku: item.sku || item.item_name,
        item_name: item.item_name,
        quantity: item.reorder_quantity || (item.safety_threshold * 2),
        unit_of_measure: item.unit_of_measure,
        unit_cost_ugx: item.unit_cost_ugx,
        supplier_name: item.supplier_name,
        supplier_contact: item.supplier_contact,
        current_stock: item.current_stock,
        safety_threshold: item.safety_threshold,
        tenant_id: item.tenant_id,
        requested_by: callerEmail,
        requested_at: new Date().toISOString(),
      };

      let merx365PoId = null;
      let poStatus = 'pending';

      // Submit to Merx365 if configured
      if (MERX365_API_URL && MERX365_API_KEY) {
        try {
          const merxRes = await fetch(`${MERX365_API_URL}/purchase-orders`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${MERX365_API_KEY}`,
              'X-App-Source': 'NLSWMS',
            },
            body: JSON.stringify(poPayload),
          });

          if (merxRes.ok) {
            const merxData = await merxRes.json();
            merx365PoId = merxData?.po_id || merxData?.id || null;
            poStatus = 'submitted';
          }
        } catch (merxErr) {
          console.error('Merx365 API error:', merxErr.message);
          // Still mark as pending even if Merx fails
        }
      }

      // Update inventory item po_status
      await base44.asServiceRole.entities.Inventory.update(item.id, {
        po_status: poStatus,
        merx365_po_id: merx365PoId,
      });

      results.push({
        item_id: item.id,
        item_name: item.item_name,
        current_stock: item.current_stock,
        safety_threshold: item.safety_threshold,
        reorder_quantity: item.reorder_quantity,
        po_status: poStatus,
        merx365_po_id: merx365PoId,
      });
    }

    return Response.json({
      checked_at: new Date().toISOString(),
      items_checked: items.length,
      alerts_triggered: results.length,
      purchase_orders: results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});