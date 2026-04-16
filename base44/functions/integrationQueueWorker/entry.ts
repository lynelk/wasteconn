import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Integration Queue Worker — retries failed events with exponential backoff
// Also classifies dead-letter failures and auto-remediates via AI
// Called by scheduled automation every 5 minutes

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      // Allow scheduled calls (no user context) or admin
      const body = await req.json().catch(() => ({}));
      if (!body._scheduled) return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date();

    // 1. Fetch items due for retry
    const pending = await base44.asServiceRole.entities.IntegrationQueue.filter({ status: 'pending' });
    const failed = await base44.asServiceRole.entities.IntegrationQueue.filter({ status: 'failed' });
    const dueForRetry = [...pending, ...failed].filter(item => {
      if (item.attempt_count >= (item.max_attempts || 5)) return false;
      if (!item.next_retry_at) return true;
      return new Date(item.next_retry_at) <= now;
    });

    const processed = [];
    const deadLettered = [];

    for (const item of dueForRetry.slice(0, 20)) {
      const attempt = (item.attempt_count || 0) + 1;
      const backoffMs = Math.min(Math.pow(2, attempt) * 1000, 3600000); // max 1hr
      const nextRetry = new Date(Date.now() + backoffMs).toISOString();

      if (!item.endpoint) {
        // Internal queue items without endpoint — mark success
        await base44.asServiceRole.entities.IntegrationQueue.update(item.id, { status: 'success', attempt_count: attempt });
        processed.push({ id: item.id, result: 'no_endpoint_skipped' });
        continue;
      }

      try {
        const payload = JSON.parse(item.payload || '{}');
        const response = await fetch(item.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          await base44.asServiceRole.entities.IntegrationQueue.update(item.id, {
            status: 'success',
            attempt_count: attempt,
            response_code: response.status,
            resolved_at: now.toISOString(),
          });
          processed.push({ id: item.id, result: 'success' });
        } else {
          const body = await response.text().catch(() => '');
          const isDeadLetter = attempt >= (item.max_attempts || 5);
          await base44.asServiceRole.entities.IntegrationQueue.update(item.id, {
            status: isDeadLetter ? 'dead_letter' : 'failed',
            attempt_count: attempt,
            next_retry_at: isDeadLetter ? null : nextRetry,
            response_code: response.status,
            response_body: body.slice(0, 1000),
            last_error: `HTTP ${response.status}`,
          });
          if (isDeadLetter) deadLettered.push(item.id);
          else processed.push({ id: item.id, result: 'failed_retry_scheduled' });
        }
      } catch (err) {
        const isDeadLetter = attempt >= (item.max_attempts || 5);
        await base44.asServiceRole.entities.IntegrationQueue.update(item.id, {
          status: isDeadLetter ? 'dead_letter' : 'failed',
          attempt_count: attempt,
          next_retry_at: isDeadLetter ? null : nextRetry,
          last_error: err.message,
        });
        if (isDeadLetter) deadLettered.push(item.id);
      }
    }

    // 2. AI classify + auto-remediate dead-letter items
    const unclassifiedDL = await base44.asServiceRole.entities.IntegrationQueue.filter({ status: 'dead_letter', ai_auto_remediated: false });
    for (const item of unclassifiedDL.slice(0, 5)) {
      const classification = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are an integration failure classifier for a waste management SaaS.
A webhook/API event failed ${item.attempt_count} times and is in the dead-letter queue.

Event type: ${item.event_type}
Last error: ${item.last_error || 'unknown'}
Response code: ${item.response_code || 'N/A'}
Payload (truncated): ${(item.payload || '').slice(0, 300)}

Classify the failure type and suggest auto-remediation:
- auth_expired: Token/credential expired → refresh credentials
- endpoint_unreachable: Network/DNS issue → queue for manual retry later
- payload_invalid: Data format error → flag for manual correction
- rate_limited: Too many requests → schedule retry in 1 hour
- duplicate: Already processed elsewhere → safe to close
- permanent_failure: Data not found or unrecoverable → close and notify admin`,
        response_json_schema: {
          type: 'object',
          properties: {
            failure_class: { type: 'string' },
            remediation_action: { type: 'string' },
            safe_to_auto_close: { type: 'boolean' },
            notes: { type: 'string' },
          }
        }
      });

      const update = {
        ai_failure_class: classification.failure_class,
        ai_remediation: classification.remediation_action,
        ai_auto_remediated: true,
        notes: classification.notes,
      };

      // Auto-close safe items
      if (classification.safe_to_auto_close) {
        update.status = 'success';
        update.resolved_at = now.toISOString();
      }

      await base44.asServiceRole.entities.IntegrationQueue.update(item.id, update);
    }

    return Response.json({
      success: true,
      processed: processed.length,
      dead_lettered: deadLettered.length,
      ai_classified: unclassifiedDL.slice(0, 5).length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});