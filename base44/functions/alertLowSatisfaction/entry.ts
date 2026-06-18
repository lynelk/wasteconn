import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const payload = await req.json();
    const { data: satisfaction } = payload;

    if (!satisfaction) {
      return Response.json({ skipped: true, reason: 'No satisfaction data in payload' });
    }

    // Only alert for ratings below 3
    const rating = satisfaction.rating;
    if (!rating || rating >= 3) {
      return Response.json({ skipped: true, reason: `Rating ${rating} is acceptable` });
    }

    // Fetch driver name if available
    let driverName = 'Unknown Driver';
    if (satisfaction.driver_id) {
      const users = await base44.asServiceRole.entities.User.filter({ id: satisfaction.driver_id });
      if (users.length > 0) driverName = users[0].full_name || driverName;
    }

    // Fetch zone name if available
    let zoneName = 'Unknown Zone';
    if (satisfaction.zone_id) {
      const zones = await base44.asServiceRole.entities.ServiceZone.filter({ id: satisfaction.zone_id });
      if (zones.length > 0) zoneName = zones[0].zone_name || zoneName;
    }

    const stars = '⭐'.repeat(rating) + '☆'.repeat(5 - rating);
    const message = [
      `🚨 *Low Customer Satisfaction Alert*`,
      `Rating: ${stars} *(${rating}/5)*`,
      `Driver: ${driverName}`,
      `Zone: ${zoneName}`,
      satisfaction.comment ? `Comment: "_${satisfaction.comment}_"` : null,
      `Pickup ID: \`${satisfaction.pickup_request_id || 'N/A'}\``,
      `Recorded: <!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} {time}|just now>`,
    ].filter(Boolean).join('\n');

    const connection = await base44.asServiceRole.connectors.getConnection('slackbot');
    const token = connection.access_token;

    const slackRes = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: '#ops-team', text: message, mrkdwn: true }),
    });

    const slackData = await slackRes.json();
    if (!slackData.ok) {
      console.error('Slack error:', slackData.error);
      return Response.json({ success: false, error: slackData.error }, { status: 500 });
    }

    return Response.json({ success: true, rating, driver: driverName, zone: zoneName });
  } catch (error) {
    console.error('alertLowSatisfaction error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});