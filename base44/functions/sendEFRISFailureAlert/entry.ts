import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Get the EFRIS log that triggered this
        const { efris_log_id, event } = await req.json();
        
        if (!efris_log_id) {
            return Response.json({ error: 'efris_log_id is required' }, { status: 400 });
        }

        // Fetch the EFRIS log
        const efrisLog = await base44.entities.EFRISInvoiceLog.get(efris_log_id);
        
        if (!efrisLog || efrisLog.status !== 'failed') {
            return Response.json({ message: 'No failed EFRIS log found' });
        }

        // Get all admin users
        const adminUsers = await base44.entities.User.filter({ role: 'admin' });
        
        // Send Slack alert using Slack Bot connector
        const slackMessage = {
            text: '🚨 EFRIS Invoice Generation Failed',
            blocks: [
                {
                    type: 'header',
                    text: {
                        type: 'plain_text',
                        text: '🚨 EFRIS Invoice Generation Failed',
                        emoji: true
                    }
                },
                {
                    type: 'section',
                    fields: [
                        {
                            type: 'mrkdwn',
                            text: `*Customer:*\n${efrisLog.customer_name || 'N/A'}`
                        },
                        {
                            type: 'mrkdwn',
                            text: `*Amount:*\nUGX ${efrisLog.gross_amount_ugx?.toLocaleString() || '0'}`
                        },
                        {
                            type: 'mrkdwn',
                            text: `*Invoice #:*\n${efrisLog.invoice_number || 'N/A'}`
                        },
                        {
                            type: 'mrkdwn',
                            text: `*Time:*\n${new Date(efrisLog.submission_timestamp).toLocaleString()}`
                        }
                    ]
                },
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `*Error:*\n${efrisLog.ura_response_message || efrisLog.failure_reason || 'Unknown error'}`
                    }
                },
                {
                    type: 'actions',
                    elements: [
                        {
                            type: 'button',
                            text: {
                                type: 'plain_text',
                                text: 'View in Dashboard',
                                emoji: true
                            },
                            url: 'https://app.base44.com/efris-reconciliation',
                            action_id: 'view_efris'
                        },
                        {
                            type: 'button',
                            text: {
                                type: 'plain_text',
                                text: 'Retry Now',
                                emoji: true
                            },
                            url: 'https://app.base44.com/efris-reconciliation',
                            action_id: 'retry_efris'
                        }
                    ]
                }
            ]
        };

        // Send to Slack #finance-alerts channel
        await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SLACK_BOT_TOKEN')}`
            },
            body: JSON.stringify({
                ...slackMessage,
                channel: 'finance-alerts'
            })
        });

        // Create high-priority notification for all admins
        for (const admin of adminUsers) {
            await base44.entities.Notification.create({
                tenant_id: efrisLog.tenant_id,
                user_id: admin.id,
                title: '🚨 EFRIS Invoice Failed',
                message: `Failed to generate EFRIS invoice for ${efrisLog.customer_name}. Amount: UGX ${efrisLog.gross_amount_ugx?.toLocaleString()}. Error: ${efrisLog.ura_response_message || efrisLog.failure_reason}`,
                type: 'error',
                priority: 'high',
                is_read: false,
                metadata: {
                    efris_log_id: efrisLog.id,
                    payment_id: efrisLog.payment_id,
                    action_required: true
                }
            });
        }

        // Create audit log entry
        await base44.entities.AuditLog.create({
            tenant_id: efrisLog.tenant_id,
            entity_type: 'EFRISInvoiceLog',
            entity_id: efrisLog.id,
            action: 'alert_sent',
            user_id: 'system',
            details: {
                alert_type: 'efris_failure',
                channel: 'slack',
                recipients: adminUsers.map(u => u.email),
                error_code: efrisLog.ura_response_code,
                error_message: efrisLog.ura_response_message
            },
            timestamp: new Date().toISOString()
        });

        return Response.json({ 
            success: true, 
            message: 'Alert sent to Slack and all admin users',
            admins_notified: adminUsers.length
        });

    } catch (error) {
        console.error('EFRIS failure alert error:', error);
        return Response.json({ 
            error: error.message,
            success: false 
        }, { status: 500 });
    }
});