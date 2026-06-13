import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// SLA Breach Monitor — scans open exceptions and overdue pickups against
// SLAPolicy thresholds, notifies tenant admins, and auto-escalates stale
// exceptions. Designed to run as a scheduled automation every 15 minutes.
// Auth: admin user OR scheduled call (body._scheduled).

const SEVERITY_ESCALATION_HOURS: Record<string, number> = {
  critical: 4,
  high: 12,
  medium: 24,
  low: 48,
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    if (!body._scheduled) {
      const user = await base44.auth.me().catch(() => null);
      if (!user || !['admin', 'super_admin'].includes(user.role)) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const now = new Date();

    // --- Load active SLA policies → resolution-hours by priority (fallback default) ---
    const policies = await base44.asServiceRole.entities.SLAPolicy.filter({ is_active: true });
    const escalateTo = policies.find(p => p.escalate_to)?.escalate_to || null;
    const defaultResolutionHours = policies.length
      ? Math.round(policies.reduce((s, p) => s + (p.resolution_hours || 24), 0) / policies.length)
      : 24;

    let pickupBreaches = 0;
    let exceptionEscalations = 0;

    // --- 1. Overdue pickups (pending/assigned past scheduled_date + resolution window) ---
    const pendingPickups = await base44.asServiceRole.entities.PickupRequest.filter({ status: 'pending' });
    const assignedPickups = await base44.asServiceRole.entities.PickupRequest.filter({ status: 'assigned' });
    for (const pickup of [...pendingPickups, ...assignedPickups]) {
      if (!pickup.scheduled_date) continue;
      const due = new Date(pickup.scheduled_date);
      due.setHours(due.getHours() + defaultResolutionHours);
      if (due >= now) continue;
      if (pickup.sla_breach_flagged) continue; // already notified

      await base44.asServiceRole.entities.PickupRequest.update(pickup.id, { sla_breach_flagged: true });

      await base44.asServiceRole.entities.Notification.create({
        tenant_id: pickup.tenant_id,
        customer_id: pickup.customer_id,
        channel: 'in_app',
        template_type: 'pickup_missed',
        subject: 'SLA breach: pickup overdue',
        body: `Pickup ${pickup.id} for ${pickup.address || 'customer location'} is past its SLA window (scheduled ${pickup.scheduled_date}). Status still ${pickup.status}.`,
        status: 'sent',
        sent_at: now.toISOString(),
        related_entity_type: 'PickupRequest',
        related_entity_id: pickup.id,
      });
      pickupBreaches++;
    }

    // --- 2. Auto-escalate stale open exceptions ---
    const openExceptions = await base44.asServiceRole.entities.ExceptionQueue.filter({ status: 'open' });
    for (const ex of openExceptions) {
      if (ex.next_action_taken === 'escalate') continue; // already escalated
      const createdAt = ex.created_date ? new Date(ex.created_date) : null;
      if (!createdAt) continue;
      const ageHours = (now.getTime() - createdAt.getTime()) / 3_600_000;
      const threshold = SEVERITY_ESCALATION_HOURS[ex.severity] ?? 24;
      if (ageHours < threshold) continue;

      // Bump severity one level on escalation
      const bump: Record<string, string> = { low: 'medium', medium: 'high', high: 'critical', critical: 'critical' };

      await base44.asServiceRole.entities.ExceptionQueue.update(ex.id, {
        next_action_taken: 'escalate',
        escalated_to: escalateTo || ex.escalated_to || 'ops_admin',
        severity: bump[ex.severity] || ex.severity,
        actioned_at: now.toISOString(),
        notes: `${ex.notes ? ex.notes + ' | ' : ''}Auto-escalated by slaBreachMonitor after ${Math.round(ageHours)}h open.`,
      });

      await base44.asServiceRole.entities.Notification.create({
        tenant_id: ex.tenant_id,
        channel: 'in_app',
        template_type: 'custom',
        subject: `Exception escalated: ${ex.exception_type}`,
        body: `Exception ${ex.id} (${ex.exception_type}) has been open for ${Math.round(ageHours)}h and was auto-escalated${escalateTo ? ` to ${escalateTo}` : ''}.`,
        status: 'sent',
        sent_at: now.toISOString(),
        related_entity_type: 'ExceptionQueue',
        related_entity_id: ex.id,
      });

      exceptionEscalations++;
    }

    return Response.json({
      success: true,
      pickup_breaches: pickupBreaches,
      exception_escalations: exceptionEscalations,
      run_at: now.toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
