import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle2, TrendingUp, Package, DollarSign, RefreshCw } from "lucide-react";
import { format } from "date-fns";

export default function InventoryReconciliation() {
    const queryClient = useQueryClient();
    const [reconciliationResult, setReconciliationResult] = useState(null);
    const [runningReconciliation, setRunningReconciliation] = useState(false);

    // Fetch compliance reports (reconciliation reports)
    const { data: reports } = useQuery({
        queryKey: ['reconciliation-reports'],
        queryFn: () => base44.entities.ComplianceReport.filter({ report_type: 'inventory_reconciliation' }, '-generated_at', 50)
    });

    // Run reconciliation mutation
    const runReconciliationMutation = useMutation({
        mutationFn: () => base44.functions.invoke('reconcileInventoryDistribution', {}),
        onMutate: () => {
            setRunningReconciliation(true);
            setReconciliationResult(null);
        },
        onSuccess: (data) => {
            setReconciliationResult(data.data);
            queryClient.invalidateQueries({ queryKey: ['reconciliation-reports'] });
            setRunningReconciliation(false);
        },
        onError: () => {
            setRunningReconciliation(false);
        }
    });

    const latestReport = reports && reports.length > 0 ? reports[0] : null;

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Inventory Reconciliation</h1>
                    <p className="text-muted-foreground">Compare bin liner distribution against inventory intake records</p>
                </div>
                <Button 
                    onClick={() => runReconciliationMutation.mutate()}
                    disabled={runningReconciliation}
                    className="gap-2"
                >
                    <RefreshCw className={`w-4 h-4 ${runningReconciliation ? 'animate-spin' : ''}`} />
                    {runningReconciliation ? "Running Reconciliation..." : "Run Reconciliation"}
                </Button>
            </div>

            {/* Latest Report Summary */}
            {latestReport && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5" />
                            Latest Reconciliation Report
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                            Generated on {format(new Date(latestReport.generated_at), 'PPPp')}
                        </p>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <div className="p-4 rounded-lg bg-slate-50 border">
                                <div className="flex items-center gap-2 mb-2">
                                    <Package className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-sm text-muted-foreground">Items Reviewed</span>
                                </div>
                                <div className="text-2xl font-bold">{latestReport.summary?.total_items || 0}</div>
                            </div>

                            <div className="p-4 rounded-lg bg-orange-50 border border-orange-200">
                                <div className="flex items-center gap-2 mb-2">
                                    <AlertCircle className="w-4 h-4 text-orange-600" />
                                    <span className="text-sm text-orange-700">Discrepancies Found</span>
                                </div>
                                <div className="text-2xl font-bold text-orange-700">{latestReport.summary?.items_with_discrepancies || 0}</div>
                                <p className="text-xs text-orange-600 mt-1">
                                    {latestReport.summary?.discrepancy_rate || 0}% of inventory
                                </p>
                            </div>

                            <div className="p-4 rounded-lg bg-slate-50 border">
                                <div className="flex items-center gap-2 mb-2">
                                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-sm text-muted-foreground">Total Stock Value</span>
                                </div>
                                <div className="text-2xl font-bold">
                                    UGX {((latestReport.summary?.total_stock_value || 0) / 1000000).toFixed(2)}M
                                </div>
                            </div>

                            <div className="p-4 rounded-lg bg-slate-50 border">
                                <div className="flex items-center gap-2 mb-2">
                                    <TrendingUp className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-sm text-muted-foreground">Net Variance</span>
                                </div>
                                <div className={`text-2xl font-bold ${(latestReport.summary?.total_variance_value || 0) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    UGX {((latestReport.summary?.total_variance_value || 0) / 1000).toFixed(1)}K
                                </div>
                            </div>
                        </div>

                        {/* Discrepancy Details */}
                        {latestReport.summary?.items_with_discrepancies > 0 && (
                            <div className="mt-6">
                                <h4 className="font-semibold mb-3 flex items-center gap-2 text-orange-700">
                                    <AlertCircle className="w-4 h-4" />
                                    Items Requiring Investigation
                                </h4>
                                <div className="space-y-2">
                                    {latestReport.data?.filter(i => i.has_discrepancy).slice(0, 5).map((item, idx) => (
                                        <div key={idx} className="p-3 rounded-lg border border-orange-200 bg-orange-50">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="font-medium text-sm">{item.item_name}</p>
                                                    <p className="text-xs text-orange-700">
                                                        SKU: {item.sku} • Variance: {item.variance > 0 ? '+' : ''}{item.variance} {item.unit_of_measure} ({item.variance_percentage}%)
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs text-muted-foreground">Financial Impact</p>
                                                    <p className="font-semibold text-sm text-orange-700">
                                                        UGX {Math.abs(item.financial_impact_ugx || 0).toLocaleString()}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {latestReport.summary?.items_with_discrepancies === 0 && (
                            <div className="mt-6 text-center py-6 text-green-600">
                                <CheckCircle2 className="w-12 h-12 mx-auto mb-2" />
                                <p className="font-medium">All inventory items are balanced!</p>
                                <p className="text-sm text-muted-foreground mt-1">No discrepancies detected between stock levels and distributions</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Manual Reconciliation Result */}
            {reconciliationResult && (
                <Card className="border-green-300 bg-green-50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-green-800">
                            <CheckCircle2 className="w-5 h-5" />
                            Reconciliation Complete
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-3 md:grid-cols-3">
                            <div>
                                <p className="text-sm text-green-700">Items Reviewed</p>
                                <p className="text-xl font-bold text-green-900">{reconciliationResult.summary?.total_items}</p>
                            </div>
                            <div>
                                <p className="text-sm text-green-700">Discrepancies Found</p>
                                <p className="text-xl font-bold text-green-900">{reconciliationResult.summary?.items_with_discrepancies}</p>
                            </div>
                            <div>
                                <p className="text-sm text-green-700">Discrepancy Rate</p>
                                <p className="text-xl font-bold text-green-900">{reconciliationResult.summary?.discrepancy_rate}%</p>
                            </div>
                        </div>
                        {reconciliationResult.discrepancies?.length > 0 && (
                            <div className="mt-4">
                                <p className="text-sm font-semibold text-green-800 mb-2">Top Discrepancies:</p>
                                <div className="space-y-1">
                                    {reconciliationResult.discrepancies.slice(0, 3).map((d, i) => (
                                        <p key={i} className="text-sm text-green-700">
                                            • {d.item_name}: {d.variance > 0 ? '+' : ''}{d.variance} units ({d.variance_percentage}%)
                                        </p>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Report History */}
            {reports && reports.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Reconciliation History</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {reports.map((report) => (
                                <div key={report.id} className="flex items-center justify-between p-3 border rounded-lg">
                                    <div>
                                        <p className="font-medium text-sm">
                                            {format(new Date(report.generated_at), 'PPP')}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {report.summary?.total_items} items • {report.summary?.items_with_discrepancies} discrepancies
                                        </p>
                                    </div>
                                    <Badge variant={report.summary?.items_with_discrepancies > 0 ? "destructive" : "secondary"}>
                                        {report.summary?.items_with_discrepancies > 0 ? 'Issues Found' : 'Balanced'}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {!latestReport && !reconciliationResult && (
                <div className="text-center py-12 text-muted-foreground">
                    <Package className="w-16 h-16 mx-auto mb-4 opacity-20" />
                    <p className="text-lg font-medium">No reconciliation reports yet</p>
                    <p className="text-sm mt-1">Click "Run Reconciliation" to generate your first report</p>
                    <p className="text-xs mt-2">Automated reports run monthly on the 1st at 6:00 AM</p>
                </div>
            )}
        </div>
    );
}