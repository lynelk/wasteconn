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

        // Fetch all inventory items
        const inventoryItems = await base44.entities.Inventory.filter({});
        
        // Fetch all item distributions
        const distributions = await base44.entities.ItemDistribution.filter({ 
            status: 'confirmed' 
        }, '-distribution_date', 500);

        // Build reconciliation report
        const reconciliationData = inventoryItems.map(item => {
            // Calculate total distributed quantity for this item
            const distributedForItem = distributions.filter(d => d.inventory_item_id === item.id);
            const totalDistributed = distributedForItem.reduce((sum, d) => sum + (d.quantity || 0), 0);
            
            // Calculate variance
            const variance = item.current_stock - totalDistributed;
            const variancePercentage = item.current_stock > 0 
                ? ((item.current_stock - totalDistributed) / item.current_stock * 100) 
                : 0;

            // Flag discrepancies
            const hasDiscrepancy = variance < 0 || variancePercentage < -10; // More than 10% shortage

            return {
                inventory_item_id: item.id,
                item_name: item.item_name,
                category: item.category,
                sku: item.sku,
                current_stock: item.current_stock,
                unit_of_measure: item.unit_of_measure,
                total_distributed: totalDistributed,
                distribution_count: distributedForItem.length,
                variance: variance,
                variance_percentage: Math.round(variancePercentage * 100) / 100,
                has_discrepancy: hasDiscrepancy,
                unit_cost_ugx: item.unit_cost_ugx,
                total_value_ugx: item.current_stock * (item.unit_cost_ugx || 0),
                distributed_value_ugx: totalDistributed * (item.unit_cost_ugx || 0),
                financial_impact_ugx: variance * (item.unit_cost_ugx || 0)
            };
        });

        // Sort by discrepancy severity
        reconciliationData.sort((a, b) => {
            if (a.has_discrepancy && !b.has_discrepancy) return -1;
            if (!a.has_discrepancy && b.has_discrepancy) return 1;
            return a.variance_percentage - b.variance_percentage;
        });

        // Create reconciliation report record
        const report = await base44.entities.ComplianceReport.create({
            tenant_id: user.data?.tenant_id || 'default',
            report_type: 'inventory_reconciliation',
            report_period: new Date().toISOString().slice(0, 7), // Current month
            generated_at: new Date().toISOString(),
            generated_by: user.id,
            status: 'completed',
            summary: {
                total_items: reconciliationData.length,
                items_with_discrepancies: reconciliationData.filter(i => i.has_discrepancy).length,
                total_stock_value: reconciliationData.reduce((sum, i) => sum + i.total_value_ugx, 0),
                total_distributed_value: reconciliationData.reduce((sum, i) => sum + i.distributed_value_ugx, 0),
                total_variance_value: reconciliationData.reduce((sum, i) => sum + i.financial_impact_ugx, 0),
                discrepancy_rate: Math.round(
                    (reconciliationData.filter(i => i.has_discrepancy).length / reconciliationData.length) * 100 * 100
                ) / 100
            },
            data: reconciliationData,
            notes: `Automated reconciliation comparing inventory stock levels against confirmed item distributions. ${reconciliationData.filter(i => i.has_discrepancy).length} items show discrepancies requiring investigation.`
        });

        // Create audit log
        await base44.entities.AuditLog.create({
            tenant_id: user.data?.tenant_id || 'default',
            entity_type: 'ComplianceReport',
            entity_id: report.id,
            action: 'inventory_reconciliation_generated',
            user_id: user.id,
            details: {
                report_type: 'inventory_reconciliation',
                items_reviewed: reconciliationData.length,
                discrepancies_found: reconciliationData.filter(i => i.has_discrepancy).length
            },
            timestamp: new Date().toISOString()
        });

        // Send notification to admin users if discrepancies found
        const itemsWithIssues = reconciliationData.filter(i => i.has_discrepancy);
        if (itemsWithIssues.length > 0) {
            const adminUsers = await base44.entities.User.filter({ role: 'admin' });
            for (const admin of adminUsers) {
                await base44.entities.Notification.create({
                    tenant_id: user.data?.tenant_id || 'default',
                    user_id: admin.id,
                    title: '⚠️ Inventory Reconciliation Discrepancies Found',
                    message: `${itemsWithIssues.length} items show stock discrepancies. Total financial impact: UGX ${Math.abs(reconciliationData.reduce((sum, i) => sum + i.financial_impact_ugx, 0)).toLocaleString()}`,
                    type: 'warning',
                    priority: 'medium',
                    is_read: false,
                    metadata: {
                        compliance_report_id: report.id,
                        action_required: true
                    }
                });
            }
        }

        return Response.json({
            success: true,
            report_id: report.id,
            summary: report.summary,
            discrepancies: itemsWithIssues.map(i => ({
                item_name: i.item_name,
                variance: i.variance,
                variance_percentage: i.variance_percentage,
                financial_impact_ugx: i.financial_impact_ugx
            }))
        });

    } catch (error) {
        console.error('Inventory reconciliation error:', error);
        return Response.json({ 
            error: error.message,
            success: false 
        }, { status: 500 });
    }
});