import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { spreadsheetTitle } = await req.json().catch(() => ({}));
    const title = spreadsheetTitle || `NLSWMS Maintenance Export ${new Date().toISOString().split('T')[0]}`;

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');

    // Fetch containers
    const containers = await base44.asServiceRole.entities.Container.list();

    // Build rows
    const headers = [
      'Label', 'Asset Type', 'Waste Stream', 'Status', 'Fill %',
      'Last Weight (kg)', 'Max Weight (kg)', 'Capacity (L)', 'Battery %',
      'Avg Daily Fill Rate (%)', 'Last Reading', 'Zone', 'Address', 'Notes'
    ];

    const rows = containers.map(c => [
      c.label || c.qr_code || c.id,
      c.asset_category || 'smart_bin',
      c.waste_stream || '',
      c.status || '',
      typeof c.last_fill_pct === 'number' ? Math.round(c.last_fill_pct) : '',
      typeof c.last_weight_kg === 'number' ? c.last_weight_kg : '',
      typeof c.max_weight_kg === 'number' ? c.max_weight_kg : '',
      typeof c.capacity_litres === 'number' ? c.capacity_litres : '',
      typeof c.last_battery_pct === 'number' ? Math.round(c.last_battery_pct) : '',
      typeof c.avg_daily_fill_rate_pct === 'number' ? c.avg_daily_fill_rate_pct : '',
      c.last_reading_at ? new Date(c.last_reading_at).toLocaleString() : '',
      c.zone_id || '',
      c.address || '',
      c.notes || '',
    ]);

    // Create a new spreadsheet
    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: { title },
        sheets: [{ properties: { title: 'Containers' } }],
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      return Response.json({ error: `Failed to create spreadsheet: ${err}` }, { status: 500 });
    }

    const sheet = await createRes.json();
    const spreadsheetId = sheet.spreadsheetId;
    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

    // Write data
    const values = [headers, ...rows];
    const writeRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Containers!A1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values }),
      }
    );

    if (!writeRes.ok) {
      const err = await writeRes.text();
      return Response.json({ error: `Failed to write data: ${err}` }, { status: 500 });
    }

    // Bold header row
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [{
          repeatCell: {
            range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
            cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.14, green: 0.44, blue: 0.27 } } },
            fields: 'userEnteredFormat(textFormat,backgroundColor)',
          }
        }]
      }),
    });

    return Response.json({ spreadsheetUrl, spreadsheetId, rowsExported: rows.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});