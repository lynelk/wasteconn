import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me().catch(() => null);

        // Service-role guard: scheduled automations have no user session
        let client = base44;
        let tenantId = user?.data?.tenant_id || 'default';
        let generatedBy = user?.id || 'system';

        if (!user) {
            client = base44.asServiceRole;
        } else if (user.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        // Calculate period bounds for ComplianceReport required fields
        const now = new Date();
        const periodFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
        const periodTo = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

        // Fetch all inventory items
        const inventoryItems = await client.entities.Inventory.filter({});
        
        // Fetch all item distributions
        const distributions = await client.entities.ItemDistribution.filter({ 
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
        const report = await client.entities.ComplianceReport.create({
            tenant_id: tenantId,
            report_type: 'inventory_reconciliation',
            period_from: periodFrom,
            period_to: periodTo,
            report_period: new Date().toISOString().slice(0, 7), // Current month
            generated_at: new Date().toISOString(),
            generated_by: generatedBy,
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
        await client.entities.AuditLog.create({
            tenant_id: tenantId,
            entity_type: 'ComplianceReport',
            entity_id: report.id,
            event_type: 'bulk_export',
            user_id: generatedBy,
            notes: `inventory_reconciliation_generated — ${reconciliationData.length} items reviewed, ${reconciliationData.filter(i => i.has_discrepancy).length} discrepancies found`
        });

        // Send notification to admin users if discrepancies found
        const itemsWithIssues = reconciliationData.filter(i => i.has_discrepancy);
        if (itemsWithIssues.length > 0) {
            const adminUsers = await client.entities.User.filter({ role: 'admin' });
            for (const admin of adminUsers) {
                await client.entities.Notification.create({
                    tenant_id: tenantId,
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