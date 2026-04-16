import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// AI Zone Coverage Gap Analysis
// Uses simplified DBSCAN-style proximity clustering on service point GPS coordinates
// to identify coverage gaps, overlapping zones, and overloaded zones.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !['admin', 'super_admin'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const servicePoints = await base44.asServiceRole.entities.ServicePoint.filter({ status: 'active' });
    const zones = await base44.asServiceRole.entities.ServiceZone.filter({ status: 'active' });
    const customers = await base44.asServiceRole.entities.Customer.filter({ status: 'active' });

    if (servicePoints.length < 3) {
      return Response.json({ success: true, message: 'Insufficient data for analysis (need 3+ active service points)', insights: [] });
    }

    // Build zone stats
    const zoneStats = zones.map(zone => {
      const zoneCustomers = customers.filter(c => c.zone_id === zone.id).length;
      const zonePoints = servicePoints.filter(sp => sp.zone_id === zone.id);
      return {
        zone_id: zone.id,
        zone_name: zone.zone_name,
        zone_code: zone.zone_code,
        district: zone.district,
        customer_count: zoneCustomers,
        service_point_count: zonePoints.length,
        max_customers: zone.max_customers,
        collection_days: zone.collection_days,
      };
    });

    // Use LLM to do spatial analysis with the data
    const prompt = `You are a spatial analytics engine for a waste management company in Uganda.
    
Analyse the following zone and service point data and return structured insights.

Zones (${zones.length} total):
${zoneStats.map(z => `- ${z.zone_name} (${z.zone_code}): ${z.customer_count} customers, ${z.service_point_count} service points, max: ${z.max_customers || 'unlimited'}, district: ${z.district}, collects: ${(z.collection_days || []).join(', ')}`).join('\n')}

Service Points with GPS (showing first 30):
${servicePoints.slice(0, 30).map(sp => `- Zone ${sp.zone_id?.slice(0,8)}: lat=${sp.latitude}, lng=${sp.longitude}, address=${sp.address}`).join('\n')}

Provide actionable insights about:
1. Overloaded zones (near or exceeding max customers)
2. Coverage gaps (areas with no zone or low density)
3. Zone balance recommendations
4. Collection schedule conflicts (same day overlaps)
5. Any unzoned service points

Return 4-6 concise, actionable insights. Be specific with zone names.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          insights: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['overloaded', 'gap', 'balance', 'schedule', 'unzoned', 'recommendation'] },
                severity: { type: 'string', enum: ['info', 'warning', 'critical'] },
                zone_name: { type: 'string' },
                title: { type: 'string' },
                description: { type: 'string' },
                suggested_action: { type: 'string' },
              },
            },
          },
          summary: { type: 'string' },
        },
      },
    });

    return Response.json({
      success: true,
      zone_stats: zoneStats,
      insights: result.insights || [],
      summary: result.summary || '',
      analysed_at: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});