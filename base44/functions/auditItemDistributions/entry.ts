import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const GPS_RADIUS_METRES = 500; // flag if > 500m from customer location

function haversineMetres(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow scheduled/automated calls (no user) or admin-only manual calls
    let isScheduled = false;
    try {
      const user = await base44.auth.me();
      if (user && user.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    } catch {
      isScheduled = true; // scheduled trigger — no session cookie
    }

    const now = new Date();
    const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    // Fetch recent distributions
    const distributions = await base44.asServiceRole.entities.ItemDistribution.list();
    const recent = distributions.filter(d =>
      d.distribution_date >= windowStart && !d.audit_reviewed
    );

    // Fetch inventory intake totals
    const inventory = await base44.asServiceRole.entities.Inventory.list();
    const inventoryMap = {};
    for (const inv of inventory) {
      inventoryMap[inv.id] = inv;
    }

    // Aggregate distributed quantities per inventory item
    const allDist = distributions.filter(d => d.status !== 'cancelled');
    const distributedTotals = {};
    for (const d of allDist) {
      const key = d.inventory_item_id;
      distributedTotals[key] = (distributedTotals[key] || 0) + (d.quantity || 0);
    }

    const flags = [];
    const updates = [];

    for (const d of recent) {
      const reasons = [];

      // 1. GPS radius breach check
      if (d.gps_lat && d.gps_lng && d.customer_lat && d.customer_lng) {
        const dist = haversineMetres(d.gps_lat, d.gps_lng, d.customer_lat, d.customer_lng);
        if (dist > GPS_RADIUS_METRES) {
          reasons.push(`GPS breach: ${Math.round(dist)}m from customer (limit ${GPS_RADIUS_METRES}m)`);
        }
        // Update distance on record
        updates.push(base44.asServiceRole.entities.ItemDistribution.update(d.id, {
          gps_distance_m: Math.round(dist),
          gps_radius_breach: dist > GPS_RADIUS_METRES,
        }));
      }

      // 2. Inventory variance check: total distributed > total intake stock + what was originally stocked
      const inv = inventoryMap[d.inventory_item_id];
      if (inv) {
        const totalDistributed = distributedTotals[d.inventory_item_id] || 0;
        // If distributed exceeds current_stock + totalDistributed (i.e. more given than ever received)
        // We approximate: if distributed total for this item in last 30 days > reorder_quantity threshold
        if (inv.reorder_quantity && totalDistributed > inv.reorder_quantity * 3) {
          reasons.push(`High volume: ${totalDistributed} units distributed vs reorder qty ${inv.reorder_quantity}`);
        }
        // Current stock < 0 equivalent: more distributed than recorded stock
        if (inv.current_stock !== undefined && totalDistributed > (inv.current_stock + totalDistributed) * 1.05) {
          reasons.push(`Stock variance: distributed ${totalDistributed} but only ${inv.current_stock} in stock`);
        }
      }

      // 3. No linked pickup job (unattached distribution)
      if (!d.pickup_request_id) {
        reasons.push('No linked pickup job — distribution not tied to a service event');
      }

      // 4. No proof photo
      if (!d.proof_photo_url) {
        reasons.push('No proof-of-handover photo attached');
      }

      if (reasons.length > 0) {
        flags.push({ id: d.id, customer: d.customer_name_snapshot, staff: d.distributed_by_name_snapshot, reasons });
        updates.push(base44.asServiceRole.entities.ItemDistribution.update(d.id, {
          pilferage_flag: true,
          pilferage_reason: reasons.join(' | '),
        }));
      }
    }

    await Promise.all(updates);

    // Send Slack alert if any flags found
    if (flags.length > 0) {
      const lines = flags.map((f, i) =>
        `*${i + 1}. ${f.customer || 'Unknown customer'}* (Staff: ${f.staff || 'Unknown'})\n   ⚠️ ${f.reasons.join('\n   ⚠️ ')}`
      );
      const message = `🚨 *Item Distribution Audit Alert*\n${flags.length} distribution record(s) flagged in the last 24h:\n\n${lines.join('\n\n')}\n\nReview at: Distribution Audit dashboard.`;

      try {
        const connRes = await base44.asServiceRole.connectors.getConnection('slackbot');
        const token = connRes?.access_token;
        if (token) {
          await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ channel: '#fleet-alerts', text: message }),
          });
        }
      } catch (slackErr) {
        console.error('Slack notification failed:', slackErr.message);
      }
    }

    return Response.json({
      success: true,
      checked: recent.length,
      flagged: flags.length,
      flags,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});