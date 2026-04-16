import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Triggered by entity automation when PickupRequest status → completed
// Creates a CustomerSatisfaction survey record and sends in-app notification

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const pickupId = body?.data?.id || body?.event?.entity_id;
    if (!pickupId) return Response.json({ error: 'No pickup id' }, { status: 400 });

    const pickup = await base44.asServiceRole.entities.PickupRequest.get(pickupId);
    if (!pickup || pickup.status !== 'completed') {
      return Response.json({ skipped: true, reason: 'Pickup not completed' });
    }

    // Avoid duplicate surveys
    const existing = await base44.asServiceRole.entities.CustomerSatisfaction.filter({
      pickup_request_id: pickupId,
    });
    if (existing.length > 0) return Response.json({ skipped: true, reason: 'Survey already created' });

    // Create survey placeholder record
    await base44.asServiceRole.entities.CustomerSatisfaction.create({
      tenant_id: pickup.tenant_id,
      customer_id: pickup.customer_id,
      pickup_request_id: pickupId,
      zone_id: pickup.zone_id,
      driver_id: pickup.assigned_driver_id,
      surveyed: true,
    });

    // Send in-app notification to customer
    if (pickup.customer_id) {
      await base44.asServiceRole.entities.Notification.create({
        tenant_id: pickup.tenant_id,
        customer_id: pickup.customer_id,
        channel: 'in_app',
        template_type: 'pickup_completed',
        subject: 'How was your pickup today?',
        body: `Your waste collection at ${pickup.address || 'your location'} is complete. Please rate your experience in the Customer App.`,
        status: 'sent',
        sent_at: new Date().toISOString(),
        related_entity_type: 'PickupRequest',
        related_entity_id: pickupId,
      });
    }

    return Response.json({ success: true, pickupId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});