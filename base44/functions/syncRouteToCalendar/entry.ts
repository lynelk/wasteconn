import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const { event, data } = body;

    if (!data) return Response.json({ skipped: 'no data' });

    const route = data;
    // Only sync published or in_progress routes
    if (!['published', 'in_progress'].includes(route.status)) {
      return Response.json({ skipped: `status=${route.status}` });
    }

    // Get Google Calendar access token (shared connector)
    let accessToken;
    try {
      const conn = await base44.asServiceRole.connectors.getConnection('googlecalendar');
      accessToken = conn?.access_token;
    } catch (_) {
      return Response.json({ error: 'Google Calendar not connected' }, { status: 503 });
    }

    if (!accessToken) {
      return Response.json({ error: 'No Calendar access token' }, { status: 503 });
    }

    // Build event details
    const routeDate = route.route_date || new Date().toISOString().split('T')[0];
    const startTime = `${routeDate}T06:00:00`;
    const endTime = `${routeDate}T18:00:00`;

    const title = route.route_name || `Route ${route.id.slice(0, 6)}`;
    const description = [
      `Route ID: ${route.id}`,
      `Status: ${route.status}`,
      `Jobs: ${route.job_ids?.length || 0}`,
      `Est. Distance: ${route.estimated_distance_km || '?'} km`,
      `Est. Duration: ${route.estimated_duration_mins || '?'} mins`,
      route.driver_id ? `Driver ID: ${route.driver_id}` : '',
      route.vehicle_id ? `Vehicle ID: ${route.vehicle_id}` : '',
      route.notes ? `Notes: ${route.notes}` : '',
    ].filter(Boolean).join('\n');

    const calEvent = {
      summary: `🚛 ${title}`,
      description,
      start: { dateTime: startTime, timeZone: 'Africa/Kampala' },
      end: { dateTime: endTime, timeZone: 'Africa/Kampala' },
      colorId: route.status === 'in_progress' ? '5' : '2', // green=2, yellow=5
    };

    // Create or update event on primary calendar
    const calRes = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(calEvent),
      }
    );

    const calData = await calRes.json();

    if (!calRes.ok) {
      return Response.json({ error: calData.error?.message || 'Calendar API error' }, { status: 500 });
    }

    return Response.json({
      success: true,
      route_id: route.id,
      calendar_event_id: calData.id,
      calendar_event_link: calData.htmlLink,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});