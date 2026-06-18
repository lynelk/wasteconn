import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get the access token for Google Sheets
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');

    // Generate the shift report for last month
    const body = await req.json().catch(() => ({}));
    const now = new Date();
    const targetYear = body.year || (now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear());
    const targetMonth = body.month || (now.getMonth() === 0 ? 12 : now.getMonth());

    const monthStart = new Date(targetYear, targetMonth - 1, 1).toISOString().split('T')[0];
    const monthEnd = new Date(targetYear, targetMonth, 0).toISOString().split('T')[0];
    const monthLabel = new Date(targetYear, targetMonth - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });

    // Fetch data
    const [allShifts, drivers, fuelLogs] = await Promise.all([
      base44.asServiceRole.entities.DriverShift.filter({ status: 'completed' }),
      base44.asServiceRole.entities.User.list(),
      base44.asServiceRole.entities.FuelLog.list(),
    ]);

    const shifts = allShifts.filter(s => {
      const d = s.clock_in?.split('T')[0];
      return d >= monthStart && d <= monthEnd;
    });

    const monthFuelLogs = fuelLogs.filter(fl => fl.fuel_date >= monthStart && fl.fuel_date <= monthEnd);

    // Build driver reports
    const driverMap = {};
    for (const s of shifts) {
      const dId = s.driver_id;
      if (!driverMap[dId]) driverMap[dId] = [];
      driverMap[dId].push(s);
    }

    const rows = [['Driver Name', 'Month', 'Total Shifts', 'Total Hours', 'Total Distance (km)', 'Total Fuel (L)', 'Avg Efficiency (km/L)', 'Fuel Entries']];
    for (const [driverId, driverShifts] of Object.entries(driverMap)) {
      const driver = drivers.find(d => d.id === driverId);
      let totalMinutes = 0, totalDistance = 0;
      for (const s of driverShifts) {
        if (s.clock_in && s.clock_out) totalMinutes += (new Date(s.clock_out) - new Date(s.clock_in)) / 60000;
        if (s.start_odometer && s.end_odometer) totalDistance += s.end_odometer - s.start_odometer;
      }
      const driverVehicleIds = driverShifts.map(s => s.vehicle_id).filter(Boolean);
      const driverFuelLogs = monthFuelLogs.filter(fl => driverVehicleIds.includes(fl.vehicle_id));
      const totalFuel = driverFuelLogs.reduce((s, fl) => s + (fl.litres || 0), 0);
      const effLogs = driverFuelLogs.filter(fl => fl.efficiency_km_per_litre);
      const avgEff = effLogs.length > 0 ? effLogs.reduce((s, fl) => s + fl.efficiency_km_per_litre, 0) / effLogs.length : null;

      rows.push([
        driver?.full_name || driverId,
        monthLabel,
        driverShifts.length,
        Math.round(totalMinutes / 60 * 10) / 10,
        Math.round(totalDistance),
        Math.round(totalFuel * 10) / 10,
        avgEff ? Math.round(avgEff * 10) / 10 : '',
        driverFuelLogs.length,
      ]);
    }

    // Spreadsheet title
    const spreadsheetTitle = `Driver Shift Report — ${monthLabel}`;

    // Create a new Google Sheet
    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: { title: spreadsheetTitle },
        sheets: [{ properties: { title: monthLabel } }],
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      return Response.json({ error: `Failed to create spreadsheet: ${err}` }, { status: 500 });
    }

    const sheetData = await createRes.json();
    const spreadsheetId = sheetData.spreadsheetId;
    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

    // Write data to the sheet
    const writeRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(monthLabel)}!A1?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: rows }),
      }
    );

    if (!writeRes.ok) {
      const err = await writeRes.text();
      return Response.json({ error: `Failed to write data: ${err}` }, { status: 500 });
    }

    return Response.json({
      success: true,
      month: monthLabel,
      rows_written: rows.length - 1,
      spreadsheet_url: spreadsheetUrl,
      spreadsheet_id: spreadsheetId,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});