import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // For scheduled automation, use service role
    const user = await base44.auth.me();
    const isScheduled = !user;
    const sdk = isScheduled ? base44.asServiceRole : base44;

    // Fetch all customers
    const customers = await sdk.entities.Customer.filter({});
    
    // Get tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // Fetch pickups scheduled for tomorrow
    const pickups = await sdk.entities.PickupRequest.filter({
      scheduled_date: tomorrowStr
    });

    let notificationsSent = 0;
    let errors = [];

    for (const pickup of pickups) {
      const customer = customers.find(c => c.id === pickup.customer_id);
      if (!customer || customer.status !== 'active') continue;

      // Check notification preferences (default: in-app enabled)
      const sendInApp = customer.notification_inapp_enabled !== false;
      const sendEmail = customer.notification_email_enabled === true;
      const sendWhatsApp = customer.notification_whatsapp_enabled === true;

      if (!sendInApp && !sendEmail && !sendWhatsApp) continue;

      const message = `Reminder: Your waste pickup is scheduled for ${tomorrow.toLocaleDateString('en-UG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}. Please ensure your bins are accessible.`;

      // Send in-app notification
      if (sendInApp) {
        try {
          await sdk.entities.Notification.create({
            tenant_id: customer.tenant_id || 'default',
            user_id: customer.user_id,
            type: 'pickup_reminder',
            title: 'Pickup Reminder',
            message: message,
            related_entity: 'PickupRequest',
            related_entity_id: pickup.id,
            is_read: false
          });
          notificationsSent++;
        } catch (err) {
          errors.push({ customer: customer.id, type: 'in_app', error: err.message });
        }
      }

      // Send email notification
      if (sendEmail && customer.email) {
        try {
          await base44.integrations.Core.SendEmail({
            to: customer.email,
            subject: 'Pickup Reminder - Tomorrow',
            body: `${message}\n\nThank you for using our waste management services.`
          });
          notificationsSent++;
        } catch (err) {
          errors.push({ customer: customer.id, type: 'email', error: err.message });
        }
      }

      // Send WhatsApp notification via Slack
      if (sendWhatsApp && customer.phone) {
        try {
          // Note: This requires Slack-WhatsApp integration or Twilio
          // For now, we'll log it as pending implementation
          errors.push({ 
            customer: customer.id, 
            type: 'whatsapp', 
            error: 'WhatsApp integration pending - requires Twilio or Slack-WhatsApp setup' 
          });
        } catch (err) {
          errors.push({ customer: customer.id, type: 'whatsapp', error: err.message });
        }
      }
    }

    return Response.json({
      success: true,
      notifications_sent: notificationsSent,
      errors: errors.length > 0 ? errors : undefined,
      message: `Processed ${pickups.length} pickups, sent ${notificationsSent} notifications`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});