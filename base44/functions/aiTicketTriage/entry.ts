import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Auto-triage tickets and check SLA breaches.
 * Called on demand or via scheduled automation.
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { ticket_id } = body;

  // Check SLA breaches on open tickets
  const openTickets = await base44.asServiceRole.entities.Ticket.filter({});
  const now = new Date();
  let breachCount = 0;

  for (const ticket of openTickets) {
    if (['resolved', 'closed'].includes(ticket.status)) continue;

    const updates = {};
    if (ticket.sla_due_at && new Date(ticket.sla_due_at) < now && !ticket.sla_breached) {
      updates.sla_breached = true;
      breachCount++;
    }

    if (Object.keys(updates).length > 0) {
      await base44.asServiceRole.entities.Ticket.update(ticket.id, updates);
    }
  }

  // AI triage a specific ticket if requested
  let triageResult = null;
  if (ticket_id) {
    const ticket = openTickets.find(t => t.id === ticket_id);
    if (ticket && !ticket.ai_category) {
      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Triage this waste management support ticket:
Category: "${ticket.category}", Description: "${ticket.description}"
Return JSON: { ai_category: string, ai_priority: "low"|"medium"|"high"|"urgent", ai_sentiment: "positive"|"neutral"|"negative", ai_suggested_action: string }`,
        response_json_schema: { type: 'object', properties: { ai_category: {type:'string'}, ai_priority:{type:'string'}, ai_sentiment:{type:'string'}, ai_suggested_action:{type:'string'} } }
      });

      await base44.asServiceRole.entities.Ticket.update(ticket_id, { ...result, status: 'triaged' });
      triageResult = result;
    }
  }

  return Response.json({ sla_breaches_updated: breachCount, triage: triageResult });
});