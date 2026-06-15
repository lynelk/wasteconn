import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Triggered by entity automation when a Container is updated.
// Sends an email alert if fill level crosses the collection threshold.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const { event, data, old_data, changed_fields } = body;

    // Only act on fill level changes
    if (!changed_fields || !changed_fields.includes('last_fill_pct')) {
      return Response.json({ skipped: 'no fill change' });
    }

    const container = data;
    const prevFill = old_data?.last_fill_pct ?? 0;
    const currFill = container?.last_fill_pct;
    const threshold = container?.collection_threshold_pct ?? 80;

    // Only alert when crossing the threshold (not every update above it)
    if (typeof currFill !== 'number' || currFill < threshold || prevFill >= threshold) {
      return Response.json({ skipped: 'threshold not newly crossed' });
    }

    const label = container.label || container.qr_code || container.id;
    const assetType = container.asset_category === 'skip' ? 'Skip' : 'Smart Bin';
    const fillInfo = container.asset_category === 'skip' && container.last_weight_kg
      ? `Fill: ${Math.round(currFill)}% (${container.last_weight_kg} kg)`
      : `Fill: ${Math.round(currFill)}%`;

    // Find drivers (users with role=driver) to notify
    const drivers = await base44.asServiceRole.entities.User.filter({ role: 'driver' });

    if (!drivers || drivers.length === 0) {
      return Response.json({ sent: 0, reason: 'No drivers found' });
    }

    const subject = `🚛 Collection Required: ${label} at ${Math.round(currFill)}%`;
    const body_text = `
A ${assetType} has reached its collection threshold and requires immediate attention.

Asset: ${label}
Type: ${assetType}
${fillInfo}
Threshold: ${threshold}%
Zone: ${container.zone_id || 'N/A'}
Address: ${container.address || 'N/A'}
Waste Stream: ${container.waste_stream || 'N/A'}

Please prioritise collection of this asset on your next route.

— NLSWMS Alert System
    `.trim();

    let sent = 0;
    for (const driver of drivers) {
      if (driver.email) {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: driver.email,
          subject,
          body: body_text,
          from_name: 'NLSWMS Operations',
        });
        sent++;
      }
    }

    return Response.json({ sent, container: label, fill: currFill });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});