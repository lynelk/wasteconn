import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // For automation, use service role
    const user = await base44.auth.me();
    const isAutomation = !user;
    const sdk = isAutomation ? base44.asServiceRole : base44;

    const payload = await req.json();
    const { event, data } = payload;

    if (!data || !data.id) {
      return Response.json({ error: 'Invalid payload: missing shift data' }, { status: 400 });
    }

    const shift = data;
    
    // Get driver details
    const driver = await sdk.entities.User.get(shift.driver_id);
    if (!driver) {
      return Response.json({ error: 'Driver not found' }, { status: 404 });
    }

    // Check if Google Calendar connector is available
    const calendarConnection = await base44.asServiceRole.connectors.getConnection('googlecalendar');
    if (!calendarConnection) {
      return Response.json({ 
        error: 'Google Calendar connector not authorized. Please connect your Google Calendar first.',
        status: 'pending_connection'
      }, { status: 400 });
    }

    const accessToken = calendarConnection.access_token;

    // Create or update calendar event
    const eventTitle = `Driver Shift: ${driver.full_name}`;
    const eventDescription = `Shift ID: ${shift.id}\nStatus: ${shift.status}\nVehicle: ${shift.vehicle_id || 'N/A'}`;

    const calendarEvent = {
      summary: eventTitle,
      description: eventDescription,
      start: {
        dateTime: shift.started_at || shift.created_date,
        timeZone: 'Africa/Kampala'
      },
      end: {
        dateTime: shift.ended_at || new Date(new Date(shift.started_at).getTime() + 8 * 60 * 60 * 1000).toISOString(),
        timeZone: 'Africa/Kampala'
      },
      attendees: [
        { email: driver.email }
      ]
    };

    // If shift has ended, mark event as completed
    if (shift.ended_at) {
      calendarEvent.description += `\n\nShift completed at: ${shift.ended_at}`;
    }

    // Call Google Calendar API
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(calendarEvent)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to create calendar event');
    }

    const calendarResponse = await response.json();

    // Store calendar event ID in shift record
    await sdk.entities.DriverShift.update(shift.id, {
      calendar_event_id: calendarResponse.id
    });

    return Response.json({
      success: true,
      calendar_event_id: calendarResponse.id,
      message: `Shift synced to Google Calendar for ${driver.full_name}`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});