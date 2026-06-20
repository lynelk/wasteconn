import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Maps movement_type to the resulting Container custody_status
const CUSTODY_STATUS_MAP = {
  delivery: 'deployed',
  swap: 'deployed',
  recovery: 'in_stock',
  repair: 'in_repair',
  transfer: 'in_transit',
  write_off: 'retired',
};

const CUSTODIAN_TYPE_MAP = {
  depot: 'depot',
  service_point: 'customer',
  vehicle: 'vehicle',
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const {
      tenant_id,
      movement_type,
      container_id,
      from_location_type,
      from_location_id,
      to_location_type,
      to_location_id,
      customer_id,
      service_point_id,
      pickup_request_id,
      condition,
      photo_urls,
      notes,
    } = body;

    if (!tenant_id) return Response.json({ error: 'tenant_id required' }, { status: 400 });
    if (!movement_type) return Response.json({ error: 'movement_type required' }, { status: 400 });
    if (!container_id) return Response.json({ error: 'container_id required' }, { status: 400 });

    // Verify container exists
    const containers = await base44.asServiceRole.entities.Container.filter({ id: container_id });
    if (!containers?.length) return Response.json({ error: 'Container not found' }, { status: 404 });

    const now = new Date().toISOString();

    // Create the AssetMovement record
    const movement = await base44.asServiceRole.entities.AssetMovement.create({
      tenant_id,
      movement_type,
      container_id,
      from_location_type: from_location_type || null,
      from_location_id: from_location_id || null,
      to_location_type: to_location_type || null,
      to_location_id: to_location_id || null,
      customer_id: customer_id || null,
      service_point_id: service_point_id || null,
      pickup_request_id: pickup_request_id || null,
      condition: condition || 'good',
      photo_urls: photo_urls || [],
      performed_by: user.id,
      status: 'completed',
      occurred_at: now,
      notes: notes || null,
    });

    // Compute new custody state on Container
    const newCustodyStatus = CUSTODY_STATUS_MAP[movement_type] || 'in_stock';
    const newCustodianType = to_location_type ? CUSTODIAN_TYPE_MAP[to_location_type] : null;

    const containerUpdate = {
      custody_status: newCustodyStatus,
      current_custodian_type: newCustodianType,
      current_custodian_id: to_location_id || null,
      last_movement_id: movement.id,
    };

    // If delivery, set deployed_at
    if (movement_type === 'delivery') {
      containerUpdate.deployed_at = now;
    }

    await base44.asServiceRole.entities.Container.update(container_id, containerUpdate);

    // Emit integration event
    const eventType = movement_type === 'delivery' ? 'asset.deployed' : movement_type === 'recovery' ? 'asset.recovered' : `asset.${movement_type}`;
    await base44.asServiceRole.entities.IntegrationQueue.create({
      tenant_id,
      event_type: eventType,
      payload: JSON.stringify({
        container_id,
        movement_id: movement.id,
        movement_type,
        new_custody_status: newCustodyStatus,
        customer_id: customer_id || null,
        occurred_at: now,
      }),
      status: 'pending',
      created_at: now,
    });

    return Response.json({
      success: true,
      movement_id: movement.id,
      new_custody_status: newCustodyStatus,
      event_emitted: eventType,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});