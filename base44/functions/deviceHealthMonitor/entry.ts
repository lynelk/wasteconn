import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  const secret = req.headers.get('x-health-secret');
  if (secret !== Deno.env.get('HEALTH_SECRET') && Deno.env.get('HEALTH_SECRET')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const base44 = createClientFromRequest(req);

  const onlineDevices = await base44.asServiceRole.entities.IoTDevice.filter({ status: 'online' });
  const now = new Date();
  const DEFAULT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

  let markedOffline = 0;

  for (const device of onlineDevices) {
    if (!device.last_seen) continue;

    const lastSeen = new Date(device.last_seen);
    const elapsed = now - lastSeen;

    // 2x the expected interval (default 1 hour)
    if (elapsed > DEFAULT_INTERVAL_MS * 2) {
      await base44.asServiceRole.entities.IoTDevice.update(device.id, { status: 'offline' });

      // Emit to IntegrationQueue
      await base44.asServiceRole.entities.IntegrationQueue.create({
        tenant_id: device.tenant_id,
        event_type: 'device.offline',
        payload: JSON.stringify({
          device_id: device.device_id,
          device_type: device.device_type,
          binding_type: device.binding_type,
          binding_id: device.binding_id,
          last_seen: device.last_seen,
          elapsed_minutes: Math.round(elapsed / 60000)
        }),
        status: 'pending'
      });

      markedOffline++;
    }
  }

  return Response.json({ ok: true, checked: onlineDevices.length, markedOffline });
});