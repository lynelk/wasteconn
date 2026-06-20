import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  const secret = req.headers.get('x-rollup-secret');
  if (secret !== Deno.env.get('ROLLUP_SECRET') && Deno.env.get('ROLLUP_SECRET')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const base44 = createClientFromRequest(req);

  // Fetch unprocessed readings
  const unprocessed = await base44.asServiceRole.entities.SensorReadingRaw.filter(
    { processed: false }, 'recorded_at', 500
  );

  if (!unprocessed.length) {
    return Response.json({ ok: true, processed: 0 });
  }

  // Group by device_id + metric_type
  const byDevice = {};
  for (const r of unprocessed) {
    const key = `${r.device_id}__${r.metric_type}`;
    if (!byDevice[key]) byDevice[key] = { device_id: r.device_id, metric_type: r.metric_type, readings: [] };
    byDevice[key].readings.push(r);
  }

  // Fetch all devices
  const deviceIds = [...new Set(unprocessed.map(r => r.device_id))];
  const deviceMap = {};
  for (const did of deviceIds) {
    const devs = await base44.asServiceRole.entities.IoTDevice.filter({ device_id: did });
    if (devs.length) deviceMap[did] = devs[0];
  }

  let fillLevelUpdates = 0;
  let gpsUpdates = 0;

  for (const [key, group] of Object.entries(byDevice)) {
    const device = deviceMap[group.device_id];
    if (!device) continue;

    if (group.metric_type === 'fill_level' && device.binding_type === 'container' && device.binding_id) {
      // Average the last 3 readings
      const sorted = group.readings.sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at));
      const last3 = sorted.slice(0, 3);
      const avgFill = last3.reduce((s, r) => s + (r.value || 0), 0) / last3.length;

      // Create a FillLevelReading (using existing SensorReading entity)
      await base44.asServiceRole.entities.SensorReading.create({
        tenant_id: device.tenant_id,
        container_id: device.binding_id,
        fill_level_pct: Math.round(avgFill),
        recorded_at: new Date().toISOString()
      });

      // Update Container
      await base44.asServiceRole.entities.Container.update(device.binding_id, {
        last_fill_pct: Math.round(avgFill),
        last_reading_at: new Date().toISOString()
      });

      fillLevelUpdates++;
    }

    if (group.metric_type === 'gps_location' && device.binding_type === 'vehicle' && device.binding_id) {
      // Take the most recent GPS reading
      const latest = group.readings.sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at))[0];
      if (latest.lat && latest.lng) {
        await base44.asServiceRole.entities.Vehicle.update(device.binding_id, {
          // These are custom fields; store in notes if no dedicated field
        });

        // Update DriverLocation if exists
        const existing = await base44.asServiceRole.entities.DriverLocation.filter({
          vehicle_id: device.binding_id
        });

        const locPayload = {
          tenant_id: device.tenant_id,
          vehicle_id: device.binding_id,
          lat: latest.lat,
          lng: latest.lng,
          recorded_at: latest.recorded_at
        };

        if (existing.length > 0) {
          await base44.asServiceRole.entities.DriverLocation.update(existing[0].id, locPayload);
        } else {
          await base44.asServiceRole.entities.DriverLocation.create(locPayload);
        }

        gpsUpdates++;
      }
    }
  }

  // Mark all as processed
  const processedIds = unprocessed.map(r => r.id);
  for (const id of processedIds) {
    await base44.asServiceRole.entities.SensorReadingRaw.update(id, { processed: true });
  }

  return Response.json({ ok: true, processed: unprocessed.length, fillLevelUpdates, gpsUpdates });
});