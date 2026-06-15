import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// AI Complaint Auto-Classification
// Classifies a complaint by category, priority, and sentiment
// and suggests a resolution action using NLP.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { complaint_id, subject, description, category } = body;

    if (!subject && !description) {
      return Response.json({ error: 'subject or description required' }, { status: 400 });
    }

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a customer service AI for a waste management company in Uganda.
      
Analyse the following customer complaint and classify it:

Subject: ${subject || '(none)'}
Description: ${description || '(none)'}
Current Category: ${category || 'not set'}

Provide:
1. The correct category (choose one: missed_collection, driver_behaviour, billing, service_quality, illegal_dumping, overflowing_bin, damaged_bin, other)
2. Priority level (low/medium/high/urgent) based on urgency and impact
3. Sentiment (positive/neutral/negative)
4. 2-3 specific pain points identified
5. Suggested resolution action in 1-2 sentences
6. Estimated resolution time in hours (e.g., 4, 24, 48)
7. Should escalate to manager? (true/false) — true if billing dispute, safety issue, or repeat complaint signals`,
      response_json_schema: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: ['missed_collection', 'driver_behaviour', 'billing', 'service_quality', 'illegal_dumping', 'overflowing_bin', 'damaged_bin', 'other'] },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
          sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
          pain_points: { type: 'array', items: { type: 'string' } },
          suggested_resolution: { type: 'string' },
          estimated_resolution_hours: { type: 'number' },
          escalate_to_manager: { type: 'boolean' },
          confidence_score: { type: 'number', description: '0-100 confidence in classification' },
        },
      },
    });

    // Update the complaint record if ID provided
    if (complaint_id) {
      await base44.asServiceRole.entities.Complaint.update(complaint_id, {
        category: result.category,
        priority: result.priority,
        ai_sentiment: result.sentiment,
        ai_pain_points: result.pain_points,
        ai_resolution_suggestion: result.suggested_resolution,
      });
    }

    return Response.json({ success: true, classification: result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});