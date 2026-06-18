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

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');

    const now = new Date();
    const start = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
    const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour duration

    const event = {
      summary: `🗑️ Bin Overflow Alert: ${container.label || container.id || 'Smart Bin'}`,
      description: `Smart bin has reached ${fillPct}% capacity (threshold: 80%).\n\nLocation: ${container.address || 'No address recorded'}\nWaste Stream: ${container.waste_stream || 'N/A'}\nBin ID: ${container.id}\n\nPlease schedule immediate collection.`,
      start: { dateTime: start.toISOString(), timeZone: 'Africa/Kampala' },
      end: { dateTime: end.toISOString(), timeZone: 'Africa/Kampala' },
      colorId: '11', // red
    };

    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });

    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: err }, { status: 500 });
    }

    const created = await res.json();
    return Response.json({ status: 'created', eventId: created.id, link: created.htmlLink });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});