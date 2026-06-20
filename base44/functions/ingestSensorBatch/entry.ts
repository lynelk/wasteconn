import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const deviceSecret = req.headers.get('x-device-secret');
  const body = await req.json();
  const { device_id, readings } = body;

  if (!device_id || !Array.isArray(readings)) {
    return Response.json({ error: 'device_id and readings[] required' }, { status: 400 });
  }

  // Verify device
  const devices = await base44.asServiceRole.entities.IoTDevice.filter({ device_id });
  if (!devices.length) {
    return Response.json({ error: 'Device not found' }, { status: 404 });
  }

  const device = devices[0];

  // Verify secret
  if (device.secret_hash && deviceSecret !== device.secret_hash) {
    return Response.json({ error: 'Invalid device secret' }, { status: 401 });
  }

  // Fetch existing idempotency keys to skip duplicates
  const recentRaws = await base44.asServiceRole.entities.SensorReadingRaw.filter(
    { device_id }, '-recorded_at', 1000
  );
  const existingKeys = new Set(recentRaws.map(r => r.idempotency_key).filter(Boolean));

  let accepted = 0;
  let skipped = 0;

  for (const reading of readings) {
    const key = reading.key || reading.idempotency_key;
    if (key && existingKeys.has(key)) {
      skipped++;
      continue;
    }

    await base44.asServiceRole.entities.SensorReadingRaw.create({
      tenant_id: device.tenant_id,
      device_id,
      metric_type: reading.metric_type,
      value: reading.value,
      lat: reading.lat || null,
      lng: reading.lng || null,
      recorded_at: reading.recorded_at || new Date().toISOString(),
      processed: false,
      idempotency_key: key || null
    });

    accepted++;
  }

  // Update last_seen
  await base44.asServiceRole.entities.IoTDevice.update(device.id, {
    last_seen: new Date().toISOString(),
    status: 'online'
  });

  return Response.json({ accepted, skipped });
});