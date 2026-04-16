import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const MERX365_API_URL = Deno.env.get('MERX365_API_URL') || '';
const MERX365_API_KEY = Deno.env.get('MERX365_API_KEY') || '';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let callerEmail = 'system';
    try {
      const user = await base44.auth.me();
      if (user) callerEmail = user.email;
    } catch (_) {}

    const items = await base44.asServiceRole.entities.Inventory.list();

    const belowThreshold = items.filter(item =>
      item.current_stock <= item.safety_threshold &&
      item.po_status !== 'pending' &&
      item.po_status !== 'submitted'
    );

    const results = [];

    for (const item of belowThreshold) {
      const orderQty = item.reorder_quantity || (item.safety_threshold * 2);
      const poPayload = {
        sku: item.sku || item.item_name,
        item_name: item.item_name,
        quantity: orderQty,
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

      // 1. Submit to Merx365 if configured
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
        }
      }

      // 2. Update inventory item
      await base44.asServiceRole.entities.Inventory.update(item.id, {
        po_status: poStatus,
        merx365_po_id: merx365PoId,
      });

      // 3. Send admin email notification
      try {
        const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
        const adminEmails = admins.map(u => u.email).filter(Boolean);

        const merxStatus = poStatus === 'submitted' ? `✅ PO submitted to Merx365 (ID: ${merx365PoId})` : '⏳ Pending Merx365 confirmation';
        const emailBody = `
<h2 style="color:#dc2626">⚠️ Low Stock Alert — Immediate Action Required</h2>

<p>The following inventory item has dropped below its safety threshold:</p>

<table style="border-collapse:collapse;width:100%;max-width:500px">
  <tr><td style="padding:6px 12px;background:#f3f4f6;font-weight:bold">Item</td><td style="padding:6px 12px">${item.item_name}</td></tr>
  <tr><td style="padding:6px 12px;background:#f3f4f6;font-weight:bold">Category</td><td style="padding:6px 12px">${(item.category || '—').replace(/_/g, ' ')}</td></tr>
  <tr><td style="padding:6px 12px;background:#fef2f2;font-weight:bold;color:#dc2626">Current Stock</td><td style="padding:6px 12px;color:#dc2626;font-weight:bold">${item.current_stock} ${item.unit_of_measure}</td></tr>
  <tr><td style="padding:6px 12px;background:#f3f4f6;font-weight:bold">Safety Threshold</td><td style="padding:6px 12px">${item.safety_threshold} ${item.unit_of_measure}</td></tr>
  <tr><td style="padding:6px 12px;background:#f3f4f6;font-weight:bold">Reorder Quantity</td><td style="padding:6px 12px">${orderQty} ${item.unit_of_measure}</td></tr>
  <tr><td style="padding:6px 12px;background:#f3f4f6;font-weight:bold">Supplier</td><td style="padding:6px 12px">${item.supplier_name || 'Not set'}</td></tr>
  <tr><td style="padding:6px 12px;background:#f3f4f6;font-weight:bold">Purchase Order</td><td style="padding:6px 12px">${merxStatus}</td></tr>
</table>

<p style="margin-top:16px;color:#6b7280;font-size:13px">This alert was triggered automatically by NLSWMS inventory monitoring at ${new Date().toISOString()}.</p>
        `.trim();

        for (const email of adminEmails) {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: email,
            subject: `🚨 Low Stock Alert: ${item.item_name} (${item.current_stock} ${item.unit_of_measure} remaining)`,
            body: emailBody,
          });
        }
      } catch (emailErr) {
        console.error('Email notification error:', emailErr.message);
      }

      results.push({
        item_id: item.id,
        item_name: item.item_name,
        current_stock: item.current_stock,
        safety_threshold: item.safety_threshold,
        reorder_quantity: orderQty,
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