import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const { data: vehicle, old_data } = body;

    if (!vehicle || !old_data) {
      return Response.json({ skipped: true, reason: 'No data provided' });
    }

    const driverChanged = vehicle.assigned_driver_id !== old_data.assigned_driver_id;
    const zoneChanged = vehicle.assigned_zone_id !== old_data.assigned_zone_id;

    if (!driverChanged && !zoneChanged) {
      return Response.json({ skipped: true, reason: 'No assignment change' });
    }

    // Fetch all admin/dispatcher users to notify
    const allUsers = await base44.asServiceRole.entities.User.list();
    const stakeholders = allUsers.filter(u =>
      u.role === 'admin' || u.role === 'super_admin' || u.role === 'dispatcher'
    );

    const changes = [];
    if (driverChanged) changes.push(`Driver assignment changed`);
    if (zoneChanged) changes.push(`Zone assignment changed`);

    const subject = `Vehicle ${vehicle.registration_number} — Assignment Updated`;
    const emailBody = `
Vehicle Assignment Update
=========================

Vehicle: ${vehicle.registration_number} (${vehicle.vehicle_type})
Make/Model: ${vehicle.make_model || 'N/A'}
Changes: ${changes.join(', ')}

Updated at: ${new Date().toLocaleString('en-UG', { timeZone: 'Africa/Kampala' })}

Please log in to NLSWMS to view full details.

NLSWMS System
    `.trim();

    // Create internal notification
    await base44.asServiceRole.entities.Notification.create({
      tenant_id: vehicle.tenant_id || 'system',
      channel: 'in_app',
      template_type: 'custom',
      subject,
      body: `Vehicle ${vehicle.registration_number}: ${changes.join(', ')}`,
      status: 'sent',
      related_entity_type: 'Vehicle',
      related_entity_id: vehicle.id,
    });

    // Email all admin/dispatchers
    let emailsSent = 0;
    for (const u of stakeholders) {
      if (u.email) {
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: u.email,
            subject,
            body: emailBody,
            from_name: 'NLSWMS Fleet Management',
          });
          emailsSent++;
        } catch (_) {}
      }
    }

    return Response.json({
      success: true,
      vehicle_id: vehicle.id,
      changes,
      emails_sent: emailsSent,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});