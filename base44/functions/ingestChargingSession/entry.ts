import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const body = await req.json();
  const { ocpp_id, event_type, vehicle_id, soc_pct, energy_kwh, tenant_id } = body;

  if (!ocpp_id || !event_type) {
    return Response.json({ error: 'ocpp_id and event_type required' }, { status: 400 });
  }

  // Find the charger by ocpp_id
  const chargers = await base44.asServiceRole.entities.Charger.filter({ ocpp_id });
  if (!chargers.length) {
    return Response.json({ error: 'Charger not found' }, { status: 404 });
  }
  const charger = chargers[0];

  if (event_type === 'start') {
    // Create a new charging session
    const session = await base44.asServiceRole.entities.ChargingSession.create({
      tenant_id: charger.tenant_id,
      charger_id: charger.id,
      vehicle_id: vehicle_id || '',
      start_soc_pct: soc_pct || 0,
      energy_kwh: 0,
      started_at: new Date().toISOString(),
      status: 'in_progress',
      source: 'grid'
    });

    // Set charger to charging
    await base44.asServiceRole.entities.Charger.update(charger.id, { status: 'charging' });

    return Response.json({ ok: true, session_id: session.id, event: 'session_started' });
  }

  if (event_type === 'stop' || event_type === 'update') {
    // Find the active session for this charger
    const sessions = await base44.asServiceRole.entities.ChargingSession.filter({
      charger_id: charger.id,
      status: 'in_progress'
    });

    if (!sessions.length) {
      return Response.json({ error: 'No active session found' }, { status: 404 });
    }

    const session = sessions[0];
    const updatePayload = {
      energy_kwh: energy_kwh || session.energy_kwh || 0,
      end_soc_pct: soc_pct
    };

    if (event_type === 'stop') {
      updatePayload.ended_at = new Date().toISOString();
      updatePayload.status = 'completed';

      // Update vehicle SoC
      if (session.vehicle_id) {
        await base44.asServiceRole.entities.Vehicle.update(session.vehicle_id, {
          current_soc_pct: soc_pct
        });
      }

      // Set charger available
      await base44.asServiceRole.entities.Charger.update(charger.id, { status: 'available' });

      // Emit to IntegrationQueue
      await base44.asServiceRole.entities.IntegrationQueue.create({
        tenant_id: charger.tenant_id,
        event_type: 'charging.completed',
        payload: JSON.stringify({
          session_id: session.id,
          vehicle_id: session.vehicle_id,
          energy_kwh: updatePayload.energy_kwh,
          end_soc_pct: soc_pct,
          charger_id: charger.id
        }),
        status: 'pending'
      });
    }

    await base44.asServiceRole.entities.ChargingSession.update(session.id, updatePayload);

    return Response.json({ ok: true, session_id: session.id, event: event_type });
  }

  return Response.json({ error: 'Unknown event_type' }, { status: 400 });
});