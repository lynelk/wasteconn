import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// AI Send-Time Optimiser — learns best channel + time per customer
// Personalises message tone based on tier and engagement history

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { customer_id, template_type, message_body } = body;

    if (!customer_id) return Response.json({ error: 'customer_id required' }, { status: 400 });

    const [customerArr, notificationHistory] = await Promise.all([
      base44.asServiceRole.entities.Customer.filter({ id: customer_id }),
      base44.asServiceRole.entities.Notification.filter({ customer_id }, '-sent_at', 30),
    ]);
    const customer = customerArr?.[0];
    if (!customer) return Response.json({ error: 'Customer not found' }, { status: 404 });

    // Analyse engagement history
    const deliveredMsgs = notificationHistory.filter(n => n.status === 'delivered');
    const channelBreakdown = {};
    for (const n of notificationHistory) {
      channelBreakdown[n.channel] = (channelBreakdown[n.channel] || 0) + 1;
    }
    const deliveredByChannel = {};
    for (const n of deliveredMsgs) {
      deliveredByChannel[n.channel] = (deliveredByChannel[n.channel] || 0) + 1;
    }

    // Hour distribution of delivered messages
    const hourDist = {};
    for (const n of deliveredMsgs) {
      if (!n.sent_at) continue;
      const h = new Date(n.sent_at).getHours();
      hourDist[h] = (hourDist[h] || 0) + 1;
    }
    const bestHour = Object.entries(hourDist).sort((a, b) => b[1] - a[1])[0]?.[0] || '9';

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a communications personalisation AI for a waste management company in Uganda.

Customer profile:
- Name: ${customer.full_name}
- Tier: ${customer.customer_tier || 'basic'}
- Segment: ${customer.customer_segment || 'individual'}
- Language: ${customer.preferred_language || 'english'}
- Mobile money: ${customer.mobile_money_provider}

Message history (last 30):
- Total sent: ${notificationHistory.length}
- Delivered: ${deliveredMsgs.length}
- By channel: ${JSON.stringify(channelBreakdown)}
- Delivery rate by channel: ${JSON.stringify(deliveredByChannel)}
- Most responsive hour (24h): ${bestHour}:00

Template type: ${template_type}
Original message: ${message_body || '(no message body provided)'}

Tasks:
1. Recommend the best channel (email/sms/whatsapp) based on delivery history
2. Recommend the best time to send (hour in Kampala timezone, EAT UTC+3)
3. Adjust tone: enterprise/premium = formal; basic/sme = friendly-casual
4. If language is luganda or swahili, add a brief greeting in that language
5. Rewrite the message body with the recommended tone (keep it short, max 3 sentences)`,
      response_json_schema: {
        type: 'object',
        properties: {
          recommended_channel: { type: 'string', enum: ['email', 'sms', 'whatsapp', 'in_app'] },
          recommended_send_hour: { type: 'number' },
          tone: { type: 'string', enum: ['formal', 'casual', 'urgent'] },
          optimised_body: { type: 'string' },
          reasoning: { type: 'string' },
        }
      }
    });

    return Response.json({
      success: true,
      customer_id,
      recommended_channel: result.recommended_channel || 'sms',
      recommended_send_hour: result.recommended_send_hour || parseInt(bestHour),
      tone: result.tone || 'formal',
      optimised_body: result.optimised_body || message_body,
      reasoning: result.reasoning,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});