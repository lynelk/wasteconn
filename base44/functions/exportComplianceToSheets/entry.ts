import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get Google Sheets access token
    const { accessToken } = await base44.asServiceRole.connectors.getConnection("googlesheets");

    // Fetch latest compliance reports
    const reports = await base44.asServiceRole.entities.ComplianceReport.list('-created_date', 100);
    const targets = await base44.asServiceRole.entities.RegionalTarget.list('-year', 100);

    if (reports.length === 0 && targets.length === 0) {
      return Response.json({ message: 'No data to export' });
    }

    // Create a new spreadsheet
    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: { title: `NLSWMS Compliance Export - ${new Date().toISOString().slice(0, 10)}` },
        sheets: [
          { properties: { title: 'Compliance Reports', sheetId: 0 } },
          { properties: { title: 'Regional Targets', sheetId: 1 } },
        ],
      }),
    });

    const spreadsheet = await createRes.json();
    if (!spreadsheet.spreadsheetId) {
      throw new Error('Failed to create spreadsheet: ' + JSON.stringify(spreadsheet));
    }

    const spreadsheetId = spreadsheet.spreadsheetId;

    // Build rows for reports sheet
    const reportRows = [
      ['Report Number', 'Type', 'Period From', 'Period To', 'Status', 'Jobs Count', 'Evidence Photos', 'Generated At'],
      ...reports.map(r => [
        r.report_number || r.id,
        r.report_type || '',
        r.period_from || '',
        r.period_to || '',
        r.status || '',
        r.jobs_count ?? '',
        r.evidence_photos_count ?? '',
        r.created_date || '',
      ]),
    ];

    // Build rows for targets sheet
    const targetRows = [
      ['Region', 'Target Name', 'Year', 'Target (kg)', 'Current (kg)', 'Progress %', 'Status'],
      ...targets.map(t => {
        const pct = t.target_value_kg > 0 ? Math.round((t.current_value_kg || 0) / t.target_value_kg * 100) : 0;
        return [
          t.region_name || '',
          t.target_name || '',
          t.year || '',
          t.target_value_kg || 0,
          t.current_value_kg || 0,
          pct + '%',
          t.status || '',
        ];
      }),
    ];

    // Write both sheets
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data: [
          { range: 'Compliance Reports!A1', values: reportRows },
          { range: 'Regional Targets!A1', values: targetRows },
        ],
      }),
    });

    return Response.json({
      success: true,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
      spreadsheetId,
      reports_exported: reports.length,
      targets_exported: targets.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});