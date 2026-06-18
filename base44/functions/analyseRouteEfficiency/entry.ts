import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const routes = await base44.asServiceRole.entities.Route.filter({ status: 'completed' }, '-completed_at', 100);
    const allJobs = await base44.asServiceRole.entities.PickupRequest.filter({ status: 'completed' }, '-completed_at', 500);

    const jobMap = {};
    for (const job of allJobs) {
      jobMap[job.id] = job;
    }

    const results = routes.map(route => {
      const jobIds = route.job_ids || [];
      const linkedJobs = jobIds.map(id => jobMap[id]).filter(Boolean);

      let actualMins = 0;
      if (route.actual_duration_mins) {
        actualMins = route.actual_duration_mins;
      } else if (route.started_at && route.completed_at) {
        actualMins = Math.round((new Date(route.completed_at) - new Date(route.started_at)) / 60000);
      } else {
        // Sum job durations
        for (const job of linkedJobs) {
          if (job.actual_duration_mins) actualMins += job.actual_duration_mins;
          else if (job.job_started_at && job.completed_at) {
            actualMins += Math.round((new Date(job.completed_at) - new Date(job.job_started_at)) / 60000);
          }
        }
      }

      const planned = route.estimated_duration_mins || 0;
      const delayMins = actualMins - planned;
      const delayPct = planned > 0 ? Math.round((delayMins / planned) * 100) : 0;

      return {
        id: route.id,
        route_name: route.route_name || `Route ${route.id.slice(0, 6)}`,
        route_date: route.route_date,
        planned_mins: planned,
        actual_mins: actualMins,
        delay_mins: delayMins,
        delay_pct: delayPct,
        job_count: linkedJobs.length,
        status: delayPct > 25 ? 'critical' : delayPct > 10 ? 'delayed' : 'on_time',
      };
    }).filter(r => r.planned_mins > 0 || r.actual_mins > 0);

    results.sort((a, b) => b.delay_pct - a.delay_pct);

    const avgDelay = results.length > 0
      ? Math.round(results.reduce((s, r) => s + r.delay_pct, 0) / results.length)
      : 0;

    return Response.json({ routes: results, avgDelayPct: avgDelay, total: results.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});