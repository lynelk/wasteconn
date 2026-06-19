import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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

        const requestBody = await req.json();
        const { efris_log_id } = requestBody;

        if (!efris_log_id) {
            return Response.json({ error: 'efris_log_id is required' }, { status: 400 });
        }

        // Fetch the failed EFRIS log
        const logs = await base44.entities.EFRISInvoiceLog.filter({ id: efris_log_id });
        if (!logs || logs.length === 0) {
            return Response.json({ error: 'EFRIS log not found' }, { status: 404 });
        }

        const efrisLog = logs[0];

        if (efrisLog.status !== 'failed') {
            return Response.json({ error: 'Only failed invoices can be retried' }, { status: 400 });
        }

        // Increment retry count
        const newRetryCount = (efrisLog.retry_count || 0) + 1;

        if (newRetryCount > 3) {
            await base44.entities.EFRISInvoiceLog.update(efris_log_id, {
                retry_count: newRetryCount,
                notes: 'Max retry attempts exceeded. Manual intervention required.'
            });

            return Response.json({ 
                error: 'Maximum retry attempts (3) exceeded. Manual review required.',
                success: false
            }, { status: 400 });
        }

        // Trigger the invoice generation function again
        const result = await base44.functions.invoke('generateEFRISInvoice', {
            payment_id: efrisLog.payment_id
        });

        if (result.data.success) {
            // Update the original log with retry count
            await base44.entities.EFRISInvoiceLog.update(efris_log_id, {
                retry_count: newRetryCount,
                notes: `Retry successful on attempt ${newRetryCount}`
            });
        }

        return Response.json({
            success: result.data.success,
            message: result.data.message,
            retry_count: newRetryCount,
            data: result.data.data
        });

    } catch (error) {
        return Response.json({ 
            error: error.message,
            success: false
        }, { status: 500 });
    }
});