import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const periodFrom = body.period_from || null;
    const periodTo = body.period_to || null;

    // Fetch pickups and waste bank transactions in parallel
    const [pickups, transactions, zones] = await Promise.all([
      base44.asServiceRole.entities.PickupRequest.list('-scheduled_date', 1000),
      base44.asServiceRole.entities.WasteBankTransaction.list('-created_date', 500),
      base44.asServiceRole.entities.ServiceZone.list(),
    ]);

    const zoneMap = {};
    for (const z of zones) zoneMap[z.id] = z.zone_name;

    // Filter by period if provided
    const filterByPeriod = (records, dateField) => {
      if (!periodFrom && !periodTo) return records;
      return records.filter(r => {
        const d = r[dateField];
        if (!d) return true;
        if (periodFrom && d < periodFrom) return false;
        if (periodTo && d > periodTo) return false;
        return true;
      });
    };

    const filteredPickups = filterByPeriod(pickups, 'scheduled_date');
    const filteredTxns = filterByPeriod(transactions, 'created_date');

    // Build CSV
    const escapeCSV = (v) => {
      if (v == null) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const row = (...cols) => cols.map(escapeCSV).join(',');

    const lines = [];

    // ── Section 1: Pickup Requests ──
    lines.push('SECTION: PICKUP REQUESTS');
    lines.push(row('Date', 'Status', 'Zone', 'Waste Type', 'Service Category', 'Actual Weight (kg)', 'Estimated Weight (kg)', 'Driver ID', 'Vehicle ID', 'Duration (mins)', 'Address', 'Source', 'Notes'));
    for (const p of filteredPickups) {
      lines.push(row(
        p.scheduled_date || p.created_date,
        p.status,
        zoneMap[p.zone_id] || p.zone_id || '—',
        p.waste_type,
        p.service_category,
        p.actual_weight_kg,
        p.estimated_weight_kg,
        p.assigned_driver_id,
        p.assigned_vehicle_id,
        p.actual_duration_mins,
        p.address,
        p.source,
        p.notes,
      ));
    }

    lines.push('');

    // ── Section 2: Waste Bank Transactions ──
    lines.push('SECTION: WASTE BANK TRANSACTIONS');
    lines.push(row('Date', 'Transaction Type', 'Waste Category', 'Grade', 'Weight (kg)', 'Rate (UGX/kg)', 'Net Amount (UGX)', 'Payment Method', 'Payment Status', 'Customer ID', 'Zone', 'Fraud Flag'));
    for (const t of filteredTxns) {
      lines.push(row(
        t.created_date,
        t.transaction_type,
        t.waste_category,
        t.grade,
        t.weight_kg,
        t.rate_ugx_per_kg,
        t.net_amount_ugx,
        t.payment_method,
        t.payment_status,
        t.customer_id,
        zoneMap[t.zone_id] || t.zone_id || '—',
        t.fraud_flag ? 'YES' : 'NO',
      ));
    }

    const csvContent = lines.join('\n');

    // Return as base64 so the frontend can trigger a download
    const encoder = new TextEncoder();
    const bytes = encoder.encode(csvContent);
    const base64 = btoa(String.fromCharCode(...bytes));

    const label = periodFrom && periodTo
      ? `${periodFrom}_to_${periodTo}`
      : new Date().toISOString().slice(0, 10);

    return Response.json({
      filename: `NLSWMS_City_Report_${label}.csv`,
      contentType: 'text/csv',
      base64,
      stats: {
        pickup_rows: filteredPickups.length,
        transaction_rows: filteredTxns.length,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});