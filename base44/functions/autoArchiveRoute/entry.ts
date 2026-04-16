import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (!data || data.status !== 'completed') {
      return Response.json({ skipped: true, reason: 'Route not completed' });
    }

    const route = data;

    // Trigger compliance report generation via internal call
    const reportRes = await base44.asServiceRole.functions.invoke('generateComplianceReport', {
      route_id: route.id,
      period_from: route.route_date,
      period_to: route.route_date,
      report_type: 'route_completion',
    });

    return Response.json({
      success: true,
      route_id: route.id,
      report_triggered: true,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});