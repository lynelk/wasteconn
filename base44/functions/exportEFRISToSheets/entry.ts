import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { google } from 'npm:googleapis@128.0.0';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (user.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        // Get the month to export (default to last month)
        const now = new Date();
        const targetMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const targetYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        const monthYear = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;

        // Fetch all successful EFRIS invoices for the month
        const invoices = await base44.entities.EFRISInvoiceLog.filter({
            month_year: monthYear,
            status: 'success'
        });

        if (!invoices || invoices.length === 0) {
            return Response.json({
                message: `No EFRIS invoices found for ${monthYear}`,
                exported_count: 0
            });
        }

        // Get Google Sheets connector
        const connection = await base44.asServiceRole.connectors.getConnection('googlesheets');
        if (!connection) {
            throw new Error('Google Sheets connector not connected. Please connect it in Settings > Integrations.');
        }

        const auth = new google.auth.OAuth2();
        auth.setCredentials({ access_token: connection.access_token });

        const sheets = google.sheets({ version: 'v4', auth });
        const drive = google.drive({ version: 'v3', auth });

        // Create a new spreadsheet
        const spreadsheetTitle = `EFRIS Tax Report - ${monthYear}`;
        const spreadsheet = await drive.files.create({
            requestBody: {
                name: spreadsheetTitle,
                mimeType: 'application/vnd.google-apps.spreadsheet'
            }
        });

        const spreadsheetId = spreadsheet.data.id;

        // Prepare data for Google Sheets
        const headers = [
            'Invoice Number',
            'Payment ID',
            'Customer Name',
            'Customer TIN',
            'Gross Amount (UGX)',
            'Net Amount (UGX)',
            'Tax Amount (UGX)',
            'Submission Date',
            'Status',
            'URA Response'
        ];

        const rows = invoices.map(inv => [
            inv.invoice_number || 'N/A',
            inv.payment_id,
            inv.customer_name,
            inv.customer_tin || 'N/A',
            inv.gross_amount_ugx,
            inv.net_amount_ugx,
            inv.tax_amount_ugx,
            inv.submission_timestamp,
            inv.status,
            inv.ura_response_message
        ]);

        const values = [headers, ...rows];

        // Write to spreadsheet
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: 'Sheet1!A1',
            valueInputOption: 'RAW',
            requestBody: { values }
        });

        // Add summary sheet
        const totalGross = invoices.reduce((sum, inv) => sum + (inv.gross_amount_ugx || 0), 0);
        const totalTax = invoices.reduce((sum, inv) => sum + (inv.tax_amount_ugx || 0), 0);

        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
                requests: [{
                    addSheet: {
                        properties: { title: 'Summary' }
                    }
                }]
            }
        });

        const summaryValues = [
            ['EFRIS Tax Summary', monthYear],
            ['Total Invoices', invoices.length.toString()],
            ['Total Gross Revenue (UGX)', totalGross.toString()],
            ['Total Tax Collected (UGX)', totalTax.toString()],
            ['Export Date', new Date().toISOString()]
        ];

        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: 'Summary!A1',
            valueInputOption: 'RAW',
            requestBody: { values: summaryValues }
        });

        // Update all EFRIS logs with sheet reference
        const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
        
        for (const inv of invoices) {
            await base44.entities.EFRISInvoiceLog.update(inv.id, {
                google_sheet_row_id: spreadsheetId
            });
        }

        return Response.json({
            success: true,
            message: `Successfully exported ${invoices.length} invoices to Google Sheets`,
            spreadsheet_id: spreadsheetId,
            spreadsheet_url: sheetUrl,
            exported_count: invoices.length,
            total_gross_ugx: totalGross,
            total_tax_ugx: totalTax
        });

    } catch (error) {
        return Response.json({ 
            error: error.message,
            success: false
        }, { status: 500 });
    }
});