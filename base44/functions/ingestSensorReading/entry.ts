import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Unified asset ingestion webhook — handles both smart-bin (volumetric) and
// skip (weight-based) telemetry. Devices POST a single reading or a batch.
//
// For smart_bin / fill_logic_type="volume":
//   - fill_level_pct is used directly as the normalised fill %.
//
// For skip / fill_logic_type="weight":
//   - weight_kg is converted to a normalised fill % using max_weight_kg.
//   - Raw weight and gain rate are stored on the Container for maintenance analytics.
//
// In both cases last_fill_pct is always written, keeping all dashboards and
// route optimisers (classifyFill / needsCollection) asset-type-agnostic.
//
// Auth: shared Bearer token (SENSOR_WEBHOOK_KEY).

function safeTimestamp(value) {
  if (value) {
    const t = Date.parse(value);
    if (!Number.isNaN(t)) return new Date(t).toISOString();
  }
  return new Date().toISOString();
}

function weightToFillPct(weightKg, maxWeightKg) {
  if (
    typeof weightKg !== 'number' || !Number.isFinite(weightKg) ||
    typeof maxWeightKg !== 'number' || !Number.isFinite(maxWeightKg) || maxWeightKg <= 0
  ) return null;
  return Math.max(0, Math.min(100, (weightKg / maxWeightKg) * 100));
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
    const readings = Array.isArray(body?.readings) ? body.readings : [body];
    const results = [];

    for (const r of readings) {
      // ── Resolve container ──────────────────────────────────────────────
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
      const isWeightBased = container.fill_logic_type === 'weight' || container.asset_category === 'skip';

      // ── Normalise fill % ───────────────────────────────────────────────
      let fillPct;
      if (isWeightBased) {
        const wKg = typeof r.weight_kg === 'number' ? r.weight_kg : null;
        const computed = weightToFillPct(wKg, container.max_weight_kg);
        fillPct = computed !== null ? computed : (container.last_fill_pct ?? 0);
      } else {
        fillPct = typeof r.fill_level_pct === 'number'
          ? Math.max(0, Math.min(100, r.fill_level_pct))
          : (container.last_fill_pct ?? 0);
      }

      // ── Persist raw SensorReading ──────────────────────────────────────
      await base44.asServiceRole.entities.SensorReading.create({
        tenant_id: container.tenant_id,
        container_id: container.id,
        sensor_id: r.qr_code || container.qr_code,
        fill_level_pct: fillPct,
        distance_cm: r.distance_cm ?? null,
        battery_pct: r.battery_pct ?? null,
        temperature_c: r.temperature_c ?? null,
        tilt_detected: !!r.tilt_detected,
        fire_detected: !!r.fire_detected,
        measured_at: measuredAt,
        source: 'webhook',
        raw_payload: JSON.stringify(r),
      });

      // ── Skip stale / out-of-order readings ────────────────────────────
      if (container.last_reading_at && Date.parse(measuredAt) <= Date.parse(container.last_reading_at)) {
        results.push({ qr_code: container.qr_code, container_id: container.id, status: 'stale_skipped' });
        continue;
      }

      // ── Smooth fill rate (shared by both asset types) ──────────────────
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

      // ── Build container update ─────────────────────────────────────────
      const updates = {
        last_fill_pct: fillPct,
        last_reading_at: measuredAt,
      };
      if (typeof r.battery_pct === 'number') updates.last_battery_pct = r.battery_pct;
      if (typeof avgRate === 'number') updates.avg_daily_fill_rate_pct = avgRate;

      // Skip-specific weight fields
      if (isWeightBased && typeof r.weight_kg === 'number') {
        updates.last_weight_kg = r.weight_kg;
        updates.weight_updated_at = measuredAt;

        // Smooth daily weight-gain rate (ignoring emptying events)
        const prevWeight = container.last_weight_kg;
        if (typeof prevWeight === 'number' && r.weight_kg >= prevWeight && container.last_reading_at) {
          const elapsedDays = (Date.parse(measuredAt) - Date.parse(container.last_reading_at)) / 86_400_000;
          if (elapsedDays > 0.01) {
            const gain = (r.weight_kg - prevWeight) / elapsedDays;
            const prev = container.avg_daily_weight_gain_kg;
            updates.avg_daily_weight_gain_kg = typeof prev === 'number'
              ? Math.round((0.5 * gain + 0.5 * prev) * 10) / 10
              : Math.round(gain * 10) / 10;
          }
        }
      }

      await base44.asServiceRole.entities.Container.update(container.id, updates);
      results.push({ qr_code: container.qr_code, container_id: container.id, status: 'ok', asset_category: container.asset_category });
    }

    return Response.json({ received: results.length, results, timestamp: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});