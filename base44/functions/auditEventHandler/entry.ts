/**
 * auditEventHandler — entity automation handler.
 * Triggered on create/update/delete of critical entities.
 * Writes an immutable AuditLog entry via the createAuditLog function.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Map entity names to audit event types
const ENTITY_EVENT_MAP = {
  PickupRequest: { create: 'job_completion', update: 'job_completion', delete: 'data_delete' },
  Invoice:       { create: 'invoice_issued',  update: 'invoice_issued',  delete: 'data_delete' },
  Payment:       { create: 'payment_settlement', update: 'payment_settlement', delete: 'data_delete' },
  Ticket:        { update: 'ticket_closed',   delete: 'data_delete' },
  RBACRole:      { create: 'permission_change', update: 'permission_change', delete: 'permission_change' },
  Customer:      { create: 'customer_created', update: 'customer_updated', delete: 'data_delete' },
};

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();

  const { event, data, old_data } = body;
  const { type: eventType, entity_name, entity_id } = event;

  const mapping = ENTITY_EVENT_MAP[entity_name];
  if (!mapping || !mapping[eventType]) {
    return Response.json({ skipped: true });
  }

  // For Ticket updates, only log when status changes to 'closed'/'resolved'
  if (entity_name === 'Ticket' && eventType === 'update') {
    if (data?.status !== 'closed' && data?.status !== 'resolved') {
      return Response.json({ skipped: true, reason: 'ticket not closed yet' });
    }
  }

  // For PickupRequest updates, only log when status changes to 'completed'
  if (entity_name === 'PickupRequest' && eventType === 'update') {
    if (data?.status !== 'completed') {
      return Response.json({ skipped: true, reason: 'job not completed yet' });
    }
  }

  const auditEventType = mapping[eventType];

  await base44.asServiceRole.functions.invoke('createAuditLog', {
    tenant_id: data?.tenant_id || old_data?.tenant_id || 'system',
    user_id: data?.created_by || old_data?.created_by || 'system',
    user_email: data?.created_by || old_data?.created_by || '',
    event_type: auditEventType,
    entity_type: entity_name,
    entity_id,
    old_value: old_data ? JSON.stringify(old_data) : undefined,
    new_value: data ? JSON.stringify(data) : undefined,
    notes: `Automated audit: ${entity_name} ${eventType}`,
  });

  return Response.json({ success: true });
});