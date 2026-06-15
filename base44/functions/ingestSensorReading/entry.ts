import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Smart-bin fill-level ingestion webhook.
// Devices POST one reading or a batch; we persist each as a SensorReading and
// roll the latest values up onto the matching Container (last fill %, battery,
// reading time, smoothed daily fill rate). This is the ingestion path that
// feeds the Container-based Smart Bins dashboard and fillLevelRouteOptimiser
// (classifyFill / needsCollection read last_fill_pct + avg_daily_fill_rate_pct).
//
// Auth: shared secret in the Authorization header (Bearer <SENSOR_WEBHOOK_KEY>),
// matching the CitoConnect webhook convention. Devices have no user session.

interface IncomingReading {
  qr_code?: string;
  label?: string;
  container_id?: string;
  tenant_id?: string;
  fill_level_pct?: number;
  distance_cm?: number;
  battery_pct?: number;
  temperature_c?: number;
  tilt_detected?: boolean;
  fire_detected?: boolean;
  measured_at?: string;
}

// Accept a client timestamp only if it parses; otherwise fall back to now.
function safeTimestamp(value?: string): string {
  if (value) {
    const t = Date.parse(value);
    if (!Number.isNaN(t)) return new Date(t).toISOString();
  }
  return new Date().toISOString();
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const authHeader = req.headers.get('Authorization') || '';
  const incomingKey = authHeader.replace('Bearer ', '').trim();
  const expectedKey = Deno.env.get('SENSOR_WEBHOOK_KEY');
  if (!expectedKey || !incomingKey || incomingKey !== expectedKey) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const readings: IncomingReading[] = Array.isArray(body?.readings) ? body.readings : [body];

    const results: Array<{ qr_code?: string; container_id?: string; status: string }> = [];

    for (const r of readings) {
      // Resolve the container by explicit id, then QR code, then label.
      // QR/label fallbacks are scoped by tenant_id when supplied to avoid
      // cross-tenant collisions on reused human-readable codes.
      const tenantScope = r.tenant_id ? { tenant_id: r.tenant_id } : {};
      let container = null;
      if (r.container_id) {
        container = await base44.asServiceRole.entities.Container.get(r.container_id).catch(() => null);
      }
      if (!container && r.qr_code) {
        container = (await base44.asServiceRole.entities.Container.filter({ ...tenantScope, qr_code: r.qr_code }))?.[0] || null;
      }
      if (!container && r.label) {
        container = (await base44.asServiceRole.entities.Container.filter({ ...tenantScope, label: r.label }))?.[0] || null;
      }
      if (!container) {
        results.push({ qr_code: r.qr_code, status: 'container_not_found' });
        continue;
      }

      const measuredAt = safeTimestamp(r.measured_at);
      const fillPct = typeof r.fill_level_pct === 'number'
        ? Math.max(0, Math.min(100, r.fill_level_pct))
        : (container.last_fill_pct ?? 0);

      // Always retain the historical reading.
      await base44.asServiceRole.entities.SensorReading.create({
        tenant_id: container.tenant_id,
        container_id: container.id,
        sensor_id: r.qr_code || container.qr_code,
        fill_level_pct: fillPct,
        distance_cm: r.distance_cm,
        battery_pct: r.battery_pct,
        temperature_c: r.temperature_c,
        tilt_detected: !!r.tilt_detected,
        fire_detected: !!r.fire_detected,
        measured_at: measuredAt,
        source: 'webhook',
        raw_payload: JSON.stringify(r),
      });

      // Skip the container roll-up for stale / out-of-order deliveries so a
      // late high-fill reading can't roll back a freshly emptied bin.
      if (container.last_reading_at && Date.parse(measuredAt) <= Date.parse(container.last_reading_at)) {
        results.push({ qr_code: container.qr_code, container_id: container.id, status: 'stale_skipped' });
        continue;
      }

      // Smooth the daily fill rate from the previous reading, ignoring
      // emptying events (fill dropped after a collection).
      let avgRate = container.avg_daily_fill_rate_pct;
      const prevFill = container.last_fill_pct;
      if (typeof prevFill === 'number' && container.last_reading_at && fillPct >= prevFill) {
        const elapsedDays = (Date.parse(measuredAt) - Date.parse(container.last_reading_at)) / 86_400_000;
        if (elapsedDays > 0.01) {
          const rate = (fillPct - prevFill) / elapsedDays;
          avgRate = typeof avgRate === 'number'
            ? Math.round((0.5 * rate + 0.5 * avgRate) * 10) / 10
            : Math.round(rate * 10) / 10;
        }
      }

      const updates: Record<string, unknown> = {
        last_fill_pct: fillPct,
        last_reading_at: measuredAt,
      };
      if (typeof r.battery_pct === 'number') updates.last_battery_pct = r.battery_pct;
      if (typeof avgRate === 'number') updates.avg_daily_fill_rate_pct = avgRate;

      await base44.asServiceRole.entities.Container.update(container.id, updates);
      results.push({ qr_code: container.qr_code, container_id: container.id, status: 'ok' });
    }

    return Response.json({ received: results.length, results, timestamp: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
