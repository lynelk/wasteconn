import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Smart-bin fill-level ingestion webhook.
// Devices POST one reading or a batch; we persist each as a SensorReading and
// roll the latest values up onto the matching SmartBin (fill level, status,
// battery, fire/tilt alarms, predictive fill rate).
//
// Auth: shared secret in the Authorization header (Bearer <SENSOR_WEBHOOK_KEY>),
// matching the CitoConnect webhook convention. Devices have no user session.

function deriveStatus(fillPct: number, thresholdPct: number): string {
  if (fillPct >= 100) return 'overflow';
  if (fillPct >= thresholdPct) return 'full';
  if (fillPct >= Math.max(0, thresholdPct - 20)) return 'warning';
  return 'ok';
}

interface IncomingReading {
  sensor_id?: string;
  bin_code?: string;
  fill_level_pct?: number;
  distance_cm?: number;
  battery_pct?: number;
  temperature_c?: number;
  tilt_detected?: boolean;
  fire_detected?: boolean;
  measured_at?: string;
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
    const readings: IncomingReading[] = Array.isArray(body?.readings)
      ? body.readings
      : [body];

    const results: Array<{ sensor_id?: string; bin_code?: string; status: string }> = [];

    for (const r of readings) {
      // Resolve the bin by sensor id first, then by asset code.
      let bin = null;
      if (r.sensor_id) {
        const bySensor = await base44.asServiceRole.entities.SmartBin.filter({ sensor_id: r.sensor_id });
        bin = bySensor?.[0] || null;
      }
      if (!bin && r.bin_code) {
        const byCode = await base44.asServiceRole.entities.SmartBin.filter({ bin_code: r.bin_code });
        bin = byCode?.[0] || null;
      }
      if (!bin) {
        results.push({ sensor_id: r.sensor_id, bin_code: r.bin_code, status: 'bin_not_found' });
        continue;
      }

      const measuredAt = r.measured_at || new Date().toISOString();
      const fillPct = typeof r.fill_level_pct === 'number'
        ? Math.max(0, Math.min(100, r.fill_level_pct))
        : bin.fill_level_pct || 0;

      await base44.asServiceRole.entities.SensorReading.create({
        tenant_id: bin.tenant_id,
        bin_id: bin.id,
        sensor_id: r.sensor_id || bin.sensor_id,
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

      // Predictive fill rate from the previous reading (pct/day), ignoring
      // emptying events (fill dropped).
      let avgFillRate = bin.avg_fill_rate_pct_per_day;
      let predictedFullAt = bin.predicted_full_at;
      if (bin.last_reading_at && fillPct >= (bin.fill_level_pct || 0)) {
        const elapsedDays = (new Date(measuredAt).getTime() - new Date(bin.last_reading_at).getTime()) / 86_400_000;
        if (elapsedDays > 0.01) {
          const rate = (fillPct - (bin.fill_level_pct || 0)) / elapsedDays;
          // Exponential smoothing against the stored rate.
          avgFillRate = bin.avg_fill_rate_pct_per_day
            ? Math.round((0.5 * rate + 0.5 * bin.avg_fill_rate_pct_per_day) * 10) / 10
            : Math.round(rate * 10) / 10;
          const threshold = bin.collection_threshold_pct || 80;
          if (avgFillRate > 0 && fillPct < threshold) {
            const daysToFull = (threshold - fillPct) / avgFillRate;
            predictedFullAt = new Date(Date.now() + daysToFull * 86_400_000).toISOString();
          }
        }
      }

      const updates: Record<string, unknown> = {
        fill_level_pct: fillPct,
        fill_status: deriveStatus(fillPct, bin.collection_threshold_pct || 80),
        last_reading_at: measuredAt,
        fire_alarm: !!r.fire_detected,
        tilt_alarm: !!r.tilt_detected,
      };
      if (typeof r.battery_pct === 'number') updates.battery_pct = r.battery_pct;
      if (typeof r.temperature_c === 'number') updates.temperature_c = r.temperature_c;
      if (avgFillRate != null) updates.avg_fill_rate_pct_per_day = avgFillRate;
      if (predictedFullAt) updates.predicted_full_at = predictedFullAt;

      await base44.asServiceRole.entities.SmartBin.update(bin.id, updates);
      results.push({ sensor_id: r.sensor_id, bin_code: bin.bin_code, status: 'ok' });
    }

    return Response.json({ received: results.length, results, timestamp: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
