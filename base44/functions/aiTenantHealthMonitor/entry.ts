import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * AI Tenant Health Monitor
 * Analyses cross-tenant query patterns, detects anomalies using statistical
 * deviation baselines, and auto-quarantines suspected data leakage attempts.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { scan_hours = 24, target_tenant_id } = body;

    // Fetch recent audit logs to analyse patterns
    const allLogs = await base44.asServiceRole.entities.AuditLog.list('-created_date', 500);
    const cutoff = new Date(Date.now() - scan_hours * 60 * 60 * 1000);
    const recentLogs = allLogs.filter(l => new Date(l.created_date) > cutoff);

    // Build per-user cross-tenant query fingerprints
    const userQueryMap = {};
    for (const log of recentLogs) {
      const key = log.user_id || log.user_email || 'unknown';
      if (!userQueryMap[key]) {
        userQueryMap[key] = {
          user_id: log.user_id,
          user_email: log.user_email,
          tenant_ids_accessed: new Set(),
          event_types: {},
          entity_types: {},
          bulk_operations: 0,
          total_events: 0,
        };
      }
      const u = userQueryMap[key];
      if (log.tenant_id) u.tenant_ids_accessed.add(log.tenant_id);
      u.event_types[log.event_type] = (u.event_types[log.event_type] || 0) + 1;
      u.entity_types[log.entity_type] = (u.entity_types[log.entity_type] || 0) + 1;
      if (log.event_type === 'bulk_export' || log.event_type === 'data_delete') u.bulk_operations++;
      u.total_events++;
    }

    // Statistical baseline: compute mean and std dev of tenants_accessed per user
    const accessCounts = Object.values(userQueryMap).map(u => u.tenant_ids_accessed.size);
    const mean = accessCounts.length > 0
      ? accessCounts.reduce((a, b) => a + b, 0) / accessCounts.length
      : 0;
    const variance = accessCounts.length > 0
      ? accessCounts.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / accessCounts.length
      : 0;
    const stddev = Math.sqrt(variance);
    const threshold = mean + 2 * stddev; // 2-sigma rule

    const alerts = [];

    for (const [userKey, stats] of Object.entries(userQueryMap)) {
      const tenantsCount = stats.tenant_ids_accessed.size;
      const deviationScore = stddev > 0
        ? Math.min(100, Math.round(((tenantsCount - mean) / stddev) * 25))
        : 0;

      // Cross-tenant anomaly: user accessing more tenants than 2-sigma baseline
      if (tenantsCount > threshold && tenantsCount > 1) {
        const severity = deviationScore >= 75 ? 'critical' : deviationScore >= 50 ? 'high' : 'medium';
        const alert = {
          source_tenant_id: [...stats.tenant_ids_accessed][0] || 'unknown',
          target_tenant_id: [...stats.tenant_ids_accessed].slice(1).join(','),
          alert_type: 'cross_tenant_query',
          severity,
          user_id: stats.user_id,
          user_email: stats.user_email,
          deviation_score: Math.max(0, deviationScore),
          baseline_value: mean,
          observed_value: tenantsCount,
          affected_entity_types: Object.keys(stats.entity_types),
          quarantine_applied: false,
        };

        // Auto-quarantine critical threats
        if (severity === 'critical') {
          alert.quarantine_applied = true;
          const expires = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2h quarantine
          alert.quarantine_expires_at = expires.toISOString();
          alert.notes = `Auto-quarantined: user accessed ${tenantsCount} tenants (baseline: ${mean.toFixed(1)} ± ${stddev.toFixed(1)})`;
          // Update tenant health score
          for (const tid of stats.tenant_ids_accessed) {
            await base44.asServiceRole.entities.Tenant.list().then(async (tenants) => {
              const t = tenants.find(x => x.id === tid);
              if (t) {
                await base44.asServiceRole.entities.Tenant.update(t.id, {
                  quarantine_active: true,
                  quarantine_reason: `Auto-quarantine: cross-tenant data leakage attempt by ${stats.user_email}`,
                  health_score: Math.max(0, (t.health_score || 100) - 30),
                });
              }
            }).catch(() => {});
          }
        }

        // Persist alert
        const saved = await base44.asServiceRole.entities.TenantHealthAlert.create(alert);
        alerts.push(saved);
      }

      // Bulk operation anomaly
      if (stats.bulk_operations >= 3) {
        const bulkAlert = await base44.asServiceRole.entities.TenantHealthAlert.create({
          source_tenant_id: [...stats.tenant_ids_accessed][0] || 'unknown',
          alert_type: 'unusual_query_pattern',
          severity: stats.bulk_operations >= 5 ? 'high' : 'medium',
          user_id: stats.user_id,
          user_email: stats.user_email,
          deviation_score: Math.min(100, stats.bulk_operations * 15),
          observed_value: stats.bulk_operations,
          affected_entity_types: Object.keys(stats.entity_types),
          notes: `Unusual bulk operations: ${stats.bulk_operations} bulk/delete events in ${scan_hours}h`,
        });
        alerts.push(bulkAlert);
      }
    }

    // Fetch existing open alerts for summary
    const existingAlerts = await base44.asServiceRole.entities.TenantHealthAlert.filter({ status: 'new' });

    return Response.json({
      success: true,
      scan_period_hours: scan_hours,
      users_analysed: Object.keys(userQueryMap).length,
      events_scanned: recentLogs.length,
      baseline: { mean: mean.toFixed(2), stddev: stddev.toFixed(2), threshold: threshold.toFixed(2) },
      new_alerts_created: alerts.length,
      total_open_alerts: existingAlerts.length,
      alerts_summary: alerts.map(a => ({
        id: a.id,
        type: a.alert_type,
        severity: a.severity,
        user: a.user_email,
        deviation_score: a.deviation_score,
        quarantine_applied: a.quarantine_applied,
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});