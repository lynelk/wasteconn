import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['admin', 'super_admin'].includes(user.role)) {
      return Response.json({ error: 'Forbidden: Admin role required' }, { status: 403 });
    }

    const { facility_id, material, buyer_id, quantity_kg, shipped_at, vehicle_id, manifest_url, settlement_ugx } = await req.json();

    if (!facility_id || !material || !quantity_kg) {
      return Response.json({ error: 'facility_id, material, and quantity_kg are required' }, { status: 400 });
    }

    const tenantId = user.data?.tenant_id || 'default';
    const now = new Date().toISOString();
    const today = new Date().toISOString().slice(0, 10);

    const shipment = await base44.asServiceRole.entities.OutboundShipment.create({
      tenant_id: tenantId,
      facility_id,
      material,
      buyer_id: buyer_id || null,
      quantity_kg,
      shipped_at: shipped_at || now,
      vehicle_id: vehicle_id || null,
      manifest_url: manifest_url || null,
      settlement_ugx: settlement_ugx || null,
    });

    // Update FacilityYieldRecord outbound_shipments_json for current period
    const existing = await base44.asServiceRole.entities.FacilityYieldRecord.filter({
      facility_id,
      period: today,
      tenant_id: tenantId,
    });

    if (existing && existing.length > 0) {
      const record = existing[0];
      let shipments = [];
      try { shipments = JSON.parse(record.outbound_shipments_json || '[]'); } catch (_) {}
      shipments.push({ material, buyer_id, quantity_kg, shipment_id: shipment.id });
      await base44.asServiceRole.entities.FacilityYieldRecord.update(record.id, {
        outbound_shipments_json: JSON.stringify(shipments),
      });
    }

    return Response.json({ success: true, shipment });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});