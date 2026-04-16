import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const { data: pickup, old_data, event } = body;

    if (!pickup || !old_data) {
      return Response.json({ skipped: true, reason: 'No data provided' });
    }

    const newStatus = pickup.status;
    const oldStatus = old_data.status;

    // Only act on actual status changes
    if (newStatus === oldStatus) {
      return Response.json({ skipped: true, reason: 'Status unchanged' });
    }

    const statusLabels = {
      pending: 'Pending',
      assigned: 'Assigned to Driver',
      in_progress: 'In Progress',
      completed: 'Completed',
      cancelled: 'Cancelled',
    };

    // Fetch related customer info if available
    let customerEmail = null;
    let customerName = 'Valued Customer';
    if (pickup.customer_id) {
      try {
        const customers = await base44.asServiceRole.entities.Customer.filter({ id: pickup.customer_id });
        if (customers[0]) {
          customerEmail = customers[0].email;
          customerName = customers[0].full_name;
        }
      } catch (_) {}
    }

    const emailBody = `
Dear ${customerName},

Your waste collection pickup request has been updated.

📍 Address: ${pickup.address || 'N/A'}
🗓  Scheduled: ${pickup.scheduled_date || 'TBD'}
🔄 Status Changed: ${statusLabels[oldStatus] || oldStatus} → ${statusLabels[newStatus] || newStatus}
${pickup.waste_type ? `♻️  Waste Type: ${pickup.waste_type.replace(/_/g, ' ')}` : ''}
${pickup.driver_notes ? `📝 Driver Notes: ${pickup.driver_notes}` : ''}

Thank you for using NLSWMS Waste Management Services.

Best regards,
NLSWMS Operations Team
    `.trim();

    // Create internal notification record
    await base44.asServiceRole.entities.Notification.create({
      tenant_id: pickup.tenant_id || 'system',
      customer_id: pickup.customer_id,
      recipient_email: customerEmail,
      channel: 'email',
      template_type: newStatus === 'completed' ? 'pickup_completed' : newStatus === 'cancelled' ? 'pickup_missed' : 'pickup_reminder',
      subject: `Pickup Status Update: ${statusLabels[newStatus] || newStatus}`,
      body: `Pickup at ${pickup.address || 'your location'} is now ${statusLabels[newStatus] || newStatus}.`,
      status: 'pending',
      related_entity_type: 'PickupRequest',
      related_entity_id: pickup.id,
    });

    // Send email if customer has email
    if (customerEmail) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: customerEmail,
        subject: `Pickup Status Update: ${statusLabels[newStatus] || newStatus}`,
        body: emailBody,
        from_name: 'NLSWMS Operations',
      });
    }

    return Response.json({
      success: true,
      pickup_id: pickup.id,
      old_status: oldStatus,
      new_status: newStatus,
      notified: !!customerEmail,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});