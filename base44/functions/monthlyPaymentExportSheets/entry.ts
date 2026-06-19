import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow scheduled (no user) or admin-only manual calls
    let isScheduled = false;
    try {
      const user = await base44.auth.me();
      if (user?.role !== 'admin') {
        return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
      }
    } catch {
      // Called from automation scheduler — no user session
      isScheduled = true;
    }

    // Fetch last month's payments
    const now = new Date();
    const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const from = firstOfLastMonth.toISOString().slice(0, 10);
    const to = lastOfLastMonth.toISOString().slice(0, 10);

    const payments = await base44.asServiceRole.entities.Payment.filter({});
    const filtered = payments.filter(p => p.payment_date >= from && p.payment_date <= to);

    const subscriptions = await base44.asServiceRole.entities.Subscription.filter({});

    // Build summary rows
    const rows = filtered.map(p => {
      const sub = subscriptions.find(s => s.id === p.subscription_id);
      return [
        p.payment_date || '',
        p.customer_id?.slice(0, 12) || '',
        p.transaction_ref || '',
        p.payment_method || '',
        p.amount_ugx || 0,
        p.status || '',
        sub?.plan_id?.slice(0, 12) || '',
        p.notes || '',
      ];
    });

    const connection = await base44.asServiceRole.connectors.getConnection('googlesheets');
    const token = connection.access_token;

    // Create a new spreadsheet
    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        properties: { title: `Payment Export — ${from} to ${to}` },
        sheets: [{ properties: { title: 'Payments' } }],
      }),
    });
    const sheet = await createRes.json();
    const spreadsheetId = sheet.spreadsheetId;

    // Write header + data
    const headerRow = ['Date', 'Customer ID', 'Transaction Ref', 'Method', 'Amount (UGX)', 'Status', 'Plan', 'Notes'];
    const values = [headerRow, ...rows];

    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Payments!A1:append?valueInputOption=RAW`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }),
    });

    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
    console.info(`Monthly payment export complete: ${rows.length} rows → ${spreadsheetUrl}`);

    return Response.json({
      success: true,
      rows_exported: rows.length,
      period_from: from,
      period_to: to,
      spreadsheetUrl,
    });
  } catch (error) {
    console.error('monthlyPaymentExportSheets error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});