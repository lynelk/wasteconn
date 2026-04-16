import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Admin-only: runs AI analysis on CustomerSatisfaction data per zone
// Returns zone-level pain point summaries

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !['admin', 'super_admin'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const surveys = await base44.asServiceRole.entities.CustomerSatisfaction.list('-created_date', 200);
    const zones = await base44.asServiceRole.entities.ServiceZone.list();

    const responded = surveys.filter(s => s.rating != null);
    if (responded.length === 0) {
      return Response.json({ message: 'No survey responses yet', zones: [] });
    }

    // Group by zone
    const byZone = {};
    for (const s of responded) {
      const zoneId = s.zone_id || 'unknown';
      if (!byZone[zoneId]) byZone[zoneId] = [];
      byZone[zoneId].push(s);
    }

    const zoneResults = [];
    for (const [zoneId, zoneSurveys] of Object.entries(byZone)) {
      const zoneName = zones.find(z => z.id === zoneId)?.zone_name || zoneId;
      const avgRating = (zoneSurveys.reduce((s, r) => s + (r.rating || 0), 0) / zoneSurveys.length).toFixed(1);
      const comments = zoneSurveys.filter(s => s.comment).map(s => s.comment).join('\n');

      if (!comments) {
        zoneResults.push({ zone_id: zoneId, zone_name: zoneName, avg_rating: avgRating, pain_points: [], summary: 'No comments available.' });
        continue;
      }

      const analysis = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are a customer experience analyst for a waste management company in Uganda.

Zone: ${zoneName}
Average Rating: ${avgRating}/5
Total Responses: ${zoneSurveys.length}

Customer Comments:
${comments}

Identify:
1. The top 3 most common pain points or complaints
2. Any positive themes mentioned
3. One actionable recommendation for this zone

Be concise. Output in the JSON format requested.`,
        response_json_schema: {
          type: 'object',
          properties: {
            pain_points: { type: 'array', items: { type: 'string' } },
            positive_themes: { type: 'array', items: { type: 'string' } },
            recommendation: { type: 'string' },
            summary: { type: 'string' },
          }
        }
      });

      // Update each survey record with AI sentiment tags
      for (const s of zoneSurveys.filter(sv => sv.comment && !sv.ai_sentiment)) {
        const sentiment = s.rating >= 4 ? 'positive' : s.rating <= 2 ? 'negative' : 'neutral';
        await base44.asServiceRole.entities.CustomerSatisfaction.update(s.id, {
          ai_sentiment: sentiment,
          ai_pain_points: analysis.pain_points || [],
        });
      }

      zoneResults.push({
        zone_id: zoneId,
        zone_name: zoneName,
        avg_rating: avgRating,
        response_count: zoneSurveys.length,
        pain_points: analysis.pain_points || [],
        positive_themes: analysis.positive_themes || [],
        recommendation: analysis.recommendation,
        summary: analysis.summary,
      });
    }

    return Response.json({ success: true, zones: zoneResults });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});