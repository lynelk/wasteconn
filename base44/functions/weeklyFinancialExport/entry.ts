import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');

    // Fetch all completed payments
    const payments = await base44.asServiceRole.entities.Payment.filter({ status: 'completed' }, '-payment_date', 500);

    // Create a new spreadsheet
    const now = new Date();
    const weekLabel = `Week ending ${now.toLocaleDateString('en-UG', { day: '2-digit', month: 'short', year: 'numeric' })}`;

    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        properties: { title: `NLSWMS Financial Export – ${weekLabel}` },
        sheets: [{ properties: { title: 'Transactions' } }],
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      return Response.json({ error: `Failed to create sheet: ${err}` }, { status: 500 });
    }

    const sheet = await createRes.json();
    const spreadsheetId = sheet.spreadsheetId;

    // Build rows
    const headers = ['Payment Date', 'Customer ID', 'Amount (UGX)', 'Method', 'Transaction Ref', 'Mobile Money No.', 'Notes'];
    const rows = payments.map(p => [
      p.payment_date || '',
      p.customer_id || '',
      p.amount_ugx || 0,
      p.payment_method || '',
      p.transaction_ref || '',
      p.mobile_money_number || '',
      p.notes || '',
    ]);

    const values = [headers, ...rows];

    const updateRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Transactions!A1?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values }),
      }
    );

    if (!updateRes.ok) {
      const err = await updateRes.text();
      return Response.json({ error: `Failed to write data: ${err}` }, { status: 500 });
    }

    return Response.json({
      status: 'success',
      rowsExported: rows.length,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
      weekLabel,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});