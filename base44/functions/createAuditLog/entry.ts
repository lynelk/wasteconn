/**
 * createAuditLog — write an immutable audit entry.
 * Called by other backend functions or entity automations.
 *
 * Payload:
 *  {
 *    tenant_id, user_id, user_email, event_type,
 *    entity_type, entity_id,
 *    old_value?,   // JSON string
 *    new_value?,   // JSON string
 *    risk_score?,  // 0-100
 *    flagged?,     // bool
 *    ip_address?,
 *    notes?
 *  }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const HIGH_RISK_EVENTS = ['data_delete', 'permission_change', 'bulk_export'];

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const body = await req.json();

  const {
    tenant_id,
    user_id,
    user_email,
    event_type,
    entity_type,
    entity_id,
    old_value,
    new_value,
    risk_score,
    flagged,
    ip_address,
    notes,
  } = body;

  // Auto-flag high-risk event types
  const autoFlag = flagged ?? HIGH_RISK_EVENTS.includes(event_type);
  const autoRisk = risk_score ?? (HIGH_RISK_EVENTS.includes(event_type) ? 80 : 10);

  const entry = await base44.asServiceRole.entities.AuditLog.create({
    tenant_id: tenant_id || 'system',
    user_id: user_id || 'system',
    user_email: user_email || '',
    event_type,
    entity_type,
    entity_id,
    old_value: old_value ? (typeof old_value === 'string' ? old_value : JSON.stringify(old_value)) : undefined,
    new_value: new_value ? (typeof new_value === 'string' ? new_value : JSON.stringify(new_value)) : undefined,
    risk_score: autoRisk,
    flagged: autoFlag,
    ip_address,
    notes,
  });

  return Response.json({ success: true, id: entry.id });
});