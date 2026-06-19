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

        const { efris_log_id, action, notes } = await req.json();

        if (!efris_log_id || !action) {
            return Response.json({ error: 'efris_log_id and action are required' }, { status: 400 });
        }

        // Fetch the EFRIS log
        const efrisLog = await base44.entities.EFRISInvoiceLog.get(efris_log_id);
        
        if (!efrisLog) {
            return Response.json({ error: 'EFRIS log not found' }, { status: 404 });
        }

        // Log the activity
        const activityLog = await base44.entities.AuditLog.create({
            tenant_id: efrisLog.tenant_id,
            entity_type: 'EFRISInvoiceLog',
            entity_id: efrisLog.id,
            action: `manual_${action}`,
            user_id: user.id,
            details: {
                previous_status: efrisLog.status,
                action_type: action,
                notes: notes || '',
                user_email: user.email,
                user_full_name: user.full_name,
                timestamp: new Date().toISOString()
            },
            timestamp: new Date().toISOString()
        });

        // Handle specific actions
        if (action === 'status_override') {
            const { new_status } = await req.json();
            await base44.entities.EFRISInvoiceLog.update(efris_log_id, {
                status: new_status,
                notes: `${efrisLog.notes || ''}\n[Manual Override] Status changed to ${new_status} by ${user.full_name} at ${new Date().toISOString()}`
            });
        }

        if (action === 'retry_attempt') {
            const retryCount = (efrisLog.retry_count || 0) + 1;
            await base44.entities.EFRISInvoiceLog.update(efris_log_id, {
                retry_count: retryCount,
                notes: `${efrisLog.notes || ''}\n[Retry Attempt #${retryCount}] Initiated by ${user.full_name} at ${new Date().toISOString()}`
            });
        }

        if (action === 'add_note') {
            await base44.entities.EFRISInvoiceLog.update(efris_log_id, {
                notes: `${efrisLog.notes || ''}\n[Manual Note] ${notes || ''} - ${user.full_name} at ${new Date().toISOString()}`
            });
        }

        return Response.json({
            success: true,
            activity_log_id: activityLog.id,
            message: 'Activity logged successfully'
        });

    } catch (error) {
        console.error('EFRIS activity log error:', error);
        return Response.json({ 
            error: error.message,
            success: false 
        }, { status: 500 });
    }
});