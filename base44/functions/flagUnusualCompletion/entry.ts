import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Cloud-side handler: called when on-device ML detects unusual job completion speed.
// 1. Updates PickupRequest with speed_flag fields
// 2. Creates AuditLog entry
// 3. Creates ExceptionQueue entry for dispatcher review
// 4. Creates PredictiveException for AI tracking

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const {
      pickup_request_id,
      job_id,
      zone_id,
      driver_id,
      tenant_id,
      flag,          // 'too_fast' | 'too_slow'
      ratio,         // actual / avg ratio
      actual_mins,
      zone_avg_mins,
      message,
      actual_route_gps_path,
      route_distance_km,
      actual_duration_mins,
      job_started_at,
    } = body;

    const id = pickup_request_id || job_id;
    if (!id) return Response.json({ error: 'pickup_request_id required' }, { status: 400 });

    const severity = flag === 'too_fast'
      ? (ratio < 0.25 ? 'high' : 'medium')
      : (ratio > 4 ? 'critical' : ratio > 3 ? 'high' : 'medium');

    const riskScore = flag === 'too_fast'
      ? Math.min(100, Math.round((1 - ratio) * 120))
      : Math.min(100, Math.round((ratio - 1) * 40));

    const mitigationMap = {
      too_fast: 'Review GPS trace and photo evidence to verify service was rendered. Consider driver coaching on minimum dwell time.',
      too_slow: 'Check for access issues, route blockage, or incident. Dispatch support if unresponsive. Review EvidenceBundle.',
    };

    // 1. Update PickupRequest with ML signal + GPS path
    const pickupUpdate = {
      speed_flag: flag,
      speed_flag_ratio: ratio,
    };
    if (actual_route_gps_path) pickupUpdate.actual_route_gps_path = actual_route_gps_path;
    if (route_distance_km) pickupUpdate.route_distance_km = route_distance_km;
    if (actual_duration_mins) pickupUpdate.actual_duration_mins = actual_duration_mins;
    if (job_started_at) pickupUpdate.job_started_at = job_started_at;

    await base44.asServiceRole.entities.PickupRequest.update(id, pickupUpdate);

    // 2. AuditLog
    await base44.asServiceRole.entities.AuditLog.create({
      tenant_id: tenant_id || user.tenant_id || 'unknown',
      user_id: driver_id || user.id,
      user_email: user.email,
      event_type: 'job_completion',
      entity_type: 'PickupRequest',
      entity_id: id,
      risk_score: riskScore,
      flagged: true,
      notes: message,
      new_value: JSON.stringify({
        speed_flag: flag,
        ratio: Math.round(ratio * 100) / 100,
        actual_mins: Math.round(actual_mins),
        zone_avg_mins: zone_avg_mins ? Math.round(zone_avg_mins) : null,
      }),
    });

    // 3. ExceptionQueue
    await base44.asServiceRole.entities.ExceptionQueue.create({
      tenant_id: tenant_id || user.tenant_id || 'unknown',
      pickup_request_id: id,
      exception_type: 'driver_incident',
      severity,
      description: `[ML Speed Alert] ${message} | Flag: ${flag} | Ratio: ${Math.round(ratio * 100)}% of zone avg | Driver: ${driver_id || user.id}`,
      default_next_action: flag === 'too_fast' ? 'notify_customer' : 'escalate',
      status: 'open',
      ai_risk_score: riskScore,
      ai_predicted: true,
      notes: mitigationMap[flag],
    });

    // 4. PredictiveException
    await base44.asServiceRole.entities.PredictiveException.create({
      tenant_id: tenant_id || user.tenant_id || 'unknown',
      pickup_request_id: id,
      prediction_date: new Date().toISOString().split('T')[0],
      prediction_type: flag === 'too_slow' ? 'delay' : 'missed_pickup',
      risk_score: riskScore,
      confidence_score: Math.min(100, Math.round(Math.abs(1 - ratio) * 80 + 20)),
      reason: message,
      mitigation_suggestion: mitigationMap[flag],
      status: 'predicted',
    });

    return Response.json({
      success: true,
      flag,
      risk_score: riskScore,
      severity,
      message: 'Speed anomaly logged: AuditLog, ExceptionQueue, PredictiveException created.',
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});