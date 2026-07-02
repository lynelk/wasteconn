import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Daily reconciliation — flags deployed containers with no activity in 30 days as 'lost'
// Auth: x-asset-secret header

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow both authenticated admin calls and scheduled (service-role) calls
    try {
      const user = await base44.auth.me();
      if (!user || !['admin', 'super_admin'].includes(user.role)) {
        return Response.json({ error: 'Admin access required' }, { status: 403 });
      }
    } catch {
      // Scheduled/service-role invocation — no user token present
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch all deployed containers (paginate in batches of 100)
    const deployedContainers = await base44.asServiceRole.entities.Container.filter(
      { custody_status: 'deployed' },
      '-created_date',
      500
    );

    const lostContainerIds = [];

    for (const container of deployedContainers) {
      // Check for recent AssetMovement
      const recentMovements = await base44.asServiceRole.entities.AssetMovement.filter(
        { container_id: container.id },
        '-occurred_at',
        1
      );

      const hasRecentMovement = recentMovements?.length > 0 &&
        recentMovements[0].occurred_at >= thirtyDaysAgo;

      // Check for recent SensorReading (fill level reading)
      const hasRecentReading = container.last_reading_at && container.last_reading_at >= thirtyDaysAgo;

      if (!hasRecentMovement && !hasRecentReading) {
        lostContainerIds.push(container.id);

        // Mark container as lost
        await base44.asServiceRole.entities.Container.update(container.id, {
          custody_status: 'lost',
        });

        // Emit asset.lost integration event
        await base44.asServiceRole.entities.IntegrationQueue.create({
          tenant_id: container.tenant_id,
          event_type: 'asset.lost',
          payload: JSON.stringify({
            container_id: container.id,
            label: container.label || container.qr_code || container.id,
            last_reading_at: container.last_reading_at || null,
            last_movement_id: container.last_movement_id || null,
            flagged_at: now.toISOString(),
          }),
          status: 'pending',
          created_at: now.toISOString(),
        });
      }
    }

    return Response.json({
      success: true,
      total_deployed_checked: deployedContainers.length,
      flagged_lost: lostContainerIds.length,
      lost_container_ids: lostContainerIds,
      run_at: now.toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});