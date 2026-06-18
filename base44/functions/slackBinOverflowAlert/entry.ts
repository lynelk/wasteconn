import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const container = body.data || {};
    const fillPct = container.last_fill_pct || 0;

    if (fillPct < 80) {
      return Response.json({ status: 'skipped', reason: 'fill < 80%' });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('slackbot');

    const urgency = fillPct >= 95 ? '🚨 CRITICAL' : fillPct >= 90 ? '⚠️ URGENT' : '🟡 ALERT';
    const color = fillPct >= 95 ? '#e53e3e' : fillPct >= 90 ? '#dd6b20' : '#d69e2e';

    const message = {
      channel: 'smart-bins',
      username: 'NLSWMS Smart Bins',
      icon_emoji: ':wastebasket:',
      text: `${urgency}: Smart bin has reached *${fillPct}%* capacity`,
      attachments: [
        {
          color,
          fields: [
            { title: 'Bin', value: container.label || container.id || 'Unknown', short: true },
            { title: 'Fill Level', value: `${fillPct}%`, short: true },
            { title: 'Location', value: container.address || 'Not recorded', short: true },
            { title: 'Waste Stream', value: container.waste_stream || 'general', short: true },
            { title: 'Zone', value: container.zone_id || '—', short: true },
            { title: 'Status', value: container.status || 'active', short: true },
          ],
          footer: 'NLSWMS Smart Bin Monitor',
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };

    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await res.json();
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 500 });
    }

    return Response.json({ status: 'sent', ts: result.ts, channel: result.channel });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});