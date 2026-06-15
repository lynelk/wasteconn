import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// sendSmsCampaign — server-side segmentation + bulk SMS for MarketingHub.
// Sending to a large audience cannot live in the browser: this segments
// server-side (allow-listed fields), enqueues a Notification per recipient, and
// returns immediately. See docs/AGGREGATION_SPECS.md.
//
// Rate-limited (cost control) and tenant-scoped.

const PAGE = 1000;
const SAFETY_CAP = 1_000_000;
const SEGMENT_FIELDS = ['zone_id', 'customer_type', 'customer_segment', 'district', 'status'];

// Coarse fixed-window rate limiter. Fail-open: never blocks on its own errors.
async function allow(base44, key, limit, windowSec) {
  try {
    const now = Date.now();
    const [rec] = await base44.asServiceRole.entities.RateLimit.filter({ key }, '-window_start', 1);
    const fresh = rec && now - new Date(rec.window_start).getTime() < windowSec * 1000;
    if (fresh) {
      if ((rec.count || 0) >= limit) return false;
      await base44.asServiceRole.entities.RateLimit.update(rec.id, { count: (rec.count || 0) + 1 });
    } else {
      await base44.asServiceRole.entities.RateLimit.create({ key, count: 1, window_start: new Date(now).toISOString() });
    }
    return true;
  } catch {
    return true;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || !['admin', 'super_admin'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { segment = {}, message, dry_run = false } = body;
    if (!message || !message.trim()) {
      return Response.json({ error: 'message is required' }, { status: 400 });
    }

    // Max 5 campaign sends per admin per hour.
    if (!dry_run && !(await allow(base44, `sendSmsCampaign:${user.id || user.email}`, 5, 3600))) {
      return Response.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429 });
    }

    const tenantId = user.role === 'super_admin' ? (body.tenant_id || null) : user.tenant_id;
    const where = {};
    if (tenantId) where.tenant_id = tenantId;
    for (const f of SEGMENT_FIELDS) {
      if (segment[f] !== undefined && segment[f] !== '' && segment[f] !== null) where[f] = segment[f];
    }

    const E = base44.asServiceRole.entities;
    const campaignId = crypto.randomUUID();
    const smsCredits = message.length > 160 ? 2 : 1;

    let skip = 0;
    let recipients = 0;
    let queued = 0;
    let batch;
    do {
      batch = await E.Customer.filter(where, '-created_date', PAGE, skip, ['id', 'phone', 'tenant_id']);
      for (const c of batch) {
        recipients += 1;
        if (dry_run || !c.phone) continue;
        try {
          await E.Notification.create({
            tenant_id: c.tenant_id || tenantId,
            customer_id: c.id,
            channel: 'sms',
            to: c.phone,
            body: message,
            status: 'queued',
            campaign_id: campaignId,
            created_date: new Date().toISOString(),
          });
          queued += 1;
        } catch {
          // best-effort enqueue; a failed row should not abort the campaign
        }
      }
      skip += PAGE;
    } while (batch.length === PAGE && skip < SAFETY_CAP);

    return Response.json({
      success: true,
      data: {
        campaign_id: campaignId,
        recipients,
        queued,
        sms_credits_estimated: recipients * smsCredits,
        dry_run,
      },
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
