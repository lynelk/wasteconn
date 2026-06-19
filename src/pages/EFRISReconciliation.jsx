import React, { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { 
    AlertCircle, 
    CheckCircle2, 
    Clock, 
    RefreshCw, 
    FileText, 
    TrendingUp, 
    DollarSign,
    AlertTriangle,
    Download,
    BarChart3,
    Activity,
    User,
    FileCheck,
    ChevronDown
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { hasNextPage, DEFAULT_PAGE_SIZE, dedupeById } from "@/lib/pagination";

const PAGE_SIZE = DEFAULT_PAGE_SIZE; // 50

const statusColors = {
    success: "bg-green-100 text-green-800 border-green-300",
    failed: "bg-red-100 text-red-800 border-red-300",
    pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
    cancelled: "bg-gray-100 text-gray-800 border-gray-300"
};

const statusIcons = {
    success: <CheckCircle2 className="w-4 h-4" />,
    failed: <AlertCircle className="w-4 h-4" />,
    pending: <Clock className="w-4 h-4" />,
    cancelled: <AlertTriangle className="w-4 h-4" />
};

export default function EFRISReconciliation() {
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));
    const [manualNote, setManualNote] = useState("");
    const [efrisPage, setEfrisPage] = useState(1);
    const [allEfrisLogs, setAllEfrisLogs] = useState([]);
    const [loadingMore, setLoadingMore] = useState(false);

    const queryClient = useQueryClient();

    // Fetch EFRIS invoice logs — paginated 50 per page
    const { data: efrisPage1 = [], isLoading: isLoadingEFRIS } = useQuery({
        queryKey: ['efris-logs', monthFilter, efrisPage],
        queryFn: async () => {
            const results = await base44.entities.EFRISInvoiceLog.filter(
                { month_year: monthFilter },
                '-submission_timestamp',
                PAGE_SIZE * efrisPage
            );
            setAllEfrisLogs(dedupeById(results));
            return results;
        }
    });

    const efrisLogs = allEfrisLogs.length > 0 ? allEfrisLogs : efrisPage1;
    const canLoadMoreEfris = hasNextPage(efrisPage1, PAGE_SIZE * efrisPage);

    const handleLoadMoreEfris = useCallback(async () => {
        setLoadingMore(true);
        const nextPage = efrisPage + 1;
        const results = await base44.entities.EFRISInvoiceLog.filter(
            { month_year: monthFilter },
            '-submission_timestamp',
            PAGE_SIZE * nextPage
        );
        setAllEfrisLogs(dedupeById(results));
        setEfrisPage(nextPage);
        setLoadingMore(false);
    }, [efrisPage, monthFilter]);

    // Reset pagination when month changes
    const handleMonthChange = (newMonth) => {
        setMonthFilter(newMonth);
        setEfrisPage(1);
        setAllEfrisLogs([]);
    };

    // Fetch payments for the same month
    const { data: payments, isLoading: isLoadingPayments } = useQuery({
        queryKey: ['payments', monthFilter],
        queryFn: () => base44.entities.Payment.filter({ payment_date: monthFilter }, '-payment_date', 100)
    });

    // Generate EFRIS invoice mutation
    const generateMutation = useMutation({
        mutationFn: (paymentId) => base44.functions.invoke('generateEFRISInvoice', { payment_id: paymentId }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['efris-logs'] });
        }
    });

    // Retry failed invoice mutation
    const retryMutation = useMutation({
        mutationFn: (logId) => base44.functions.invoke('retryEFRISInvoice', { efris_log_id: logId }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['efris-logs'] });
        }
    });

    // Export to Sheets mutation
    const exportMutation = useMutation({
        mutationFn: () => base44.functions.invoke('exportEFRISToSheets', {}),
        onSuccess: (data) => {
            alert(`Export successful! ${data.data.exported_count} invoices exported to Google Sheets.`);
        }
    });

    // Log EFRIS activity mutation
    const logActivityMutation = useMutation({
        mutationFn: ({ efris_log_id, action, notes }) => 
            base44.functions.invoke('logEFRISActivity', { efris_log_id, action, notes }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['efris-logs'] });
            queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
        }
    });

    // Fetch audit logs for EFRIS
    const { data: auditLogs } = useQuery({
        queryKey: ['audit-logs', monthFilter],
        queryFn: () => base44.entities.AuditLog.filter({ 
            entity_type: 'EFRISInvoiceLog'
        }, '-timestamp', 200)
    });

    // Calculate statistics
    const stats = {
        total: efrisLogs?.length || 0,
        success: efrisLogs?.filter(l => l.status === 'success').length || 0,
        failed: efrisLogs?.filter(l => l.status === 'failed').length || 0,
        pending: efrisLogs?.filter(l => l.status === 'pending').length || 0,
        totalRevenue: efrisLogs?.filter(l => l.status === 'success').reduce((sum, l) => sum + (l.gross_amount_ugx || 0), 0) || 0,
        totalTax: efrisLogs?.filter(l => l.status === 'success').reduce((sum, l) => sum + (l.tax_amount_ugx || 0), 0) || 0
    };

    // Filter logs
    const filteredLogs = (efrisLogs || []).filter(log => {
        const matchesSearch = !searchTerm || 
            log.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.payment_id?.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesStatus = statusFilter === "all" || log.status === statusFilter;
        
        return matchesSearch && matchesStatus;
    });

    // Find payments without EFRIS invoices
    const paymentsWithoutEFRIS = (payments || []).filter(payment => {
        if (payment.status !== 'completed') return false;
        return !efrisLogs?.some(log => log.payment_id === payment.id && log.status === 'success');
    });

    // Prepare chart data
    const chartData = (efrisLogs || [])
        .filter(l => l.status === 'success' && l.submission_timestamp)
        .reduce((acc, log) => {
            const date = log.submission_timestamp.slice(0, 10);
            const existing = acc.find(d => d.date === date);
            if (existing) {
                existing.revenue += log.gross_amount_ugx || 0;
                existing.tax += log.tax_amount_ugx || 0;
            } else {
                acc.push({
                    date,
                    revenue: log.gross_amount_ugx || 0,
                    tax: log.tax_amount_ugx || 0
                });
            }
            return acc;
        }, [])
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(-30);

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">EFRIS Tax Compliance</h1>
                    <p className="text-muted-foreground">Monitor URA invoice generation and tax reporting</p>
                </div>
                <Button 
                    onClick={() => exportMutation.mutate()}
                    disabled={exportMutation.isPending}
                    className="gap-2"
                >
                    <Download className="w-4 h-4" />
                    {exportMutation.isPending ? "Exporting..." : "Export to Sheets"}
                </Button>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
                        <FileText className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.total}</div>
                        <p className="text-xs text-muted-foreground">
                            {stats.success} successful, {stats.failed} failed
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                        <DollarSign className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">UGX {(stats.totalRevenue / 1000000).toFixed(2)}M</div>
                        <p className="text-xs text-muted-foreground">
                            Gross amount for {monthFilter}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tax Collected</CardTitle>
                        <TrendingUp className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">UGX {(stats.totalTax / 1000000).toFixed(2)}M</div>
                        <p className="text-xs text-muted-foreground">
                            VAT for remittance to URA
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Action Required</CardTitle>
                        <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.failed + paymentsWithoutEFRIS.length}</div>
                        <p className="text-xs text-muted-foreground">
                            {stats.failed} failed, {paymentsWithoutEFRIS.length} pending
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="reconciliation">
                <TabsList>
                    <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
                    <TabsTrigger value="all-invoices">All Invoices</TabsTrigger>
                    <TabsTrigger value="analytics">Analytics</TabsTrigger>
                    <TabsTrigger value="failed">Failed ({stats.failed})</TabsTrigger>
                    <TabsTrigger value="activity-log">Activity Log</TabsTrigger>
                </TabsList>

                {/* Reconciliation Tab - Payments without EFRIS */}
                <TabsContent value="reconciliation" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <AlertCircle className="w-5 h-5 text-yellow-600" />
                                Payments Without EFRIS Invoices
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                                Completed payments that need EFRIS invoice generation
                            </p>
                        </CardHeader>
                        <CardContent>
                            {paymentsWithoutEFRIS.length === 0 ? (
                                <div className="text-center py-8 text-green-600">
                                    <CheckCircle2 className="w-12 h-12 mx-auto mb-2" />
                                    <p className="font-medium">All payments have EFRIS invoices!</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {paymentsWithoutEFRIS.map((payment) => (
                                        <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg bg-yellow-50">
                                            <div className="space-y-1">
                                                <p className="font-medium">Payment #{payment.id.slice(-8)}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    UGX {payment.amount_ugx?.toLocaleString()} • {payment.payment_date}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {payment.payment_method}
                                                </p>
                                            </div>
                                            <Button
                                                size="sm"
                                                onClick={() => generateMutation.mutate(payment.id)}
                                                disabled={generateMutation.isPending}
                                            >
                                                {generateMutation.isPending ? "Generating..." : "Generate EFRIS"}
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* All Invoices Tab */}
                <TabsContent value="all-invoices" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>All EFRIS Invoices</CardTitle>
                            <div className="flex gap-2 mt-2 flex-wrap">
                                <Input
                                    placeholder="Search by customer, invoice #..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="max-w-sm"
                                />
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="border rounded-md px-3 py-2 text-sm"
                                >
                                    <option value="all">All Status</option>
                                    <option value="success">Success</option>
                                    <option value="failed">Failed</option>
                                    <option value="pending">Pending</option>
                                </select>
                                <Input
                                    type="month"
                                    value={monthFilter}
                                    onChange={(e) => handleMonthChange(e.target.value)}
                                    className="max-w-[180px]"
                                />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {isLoadingEFRIS ? (
                                    [1,2,3].map(i => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)
                                ) : filteredLogs.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                        <p>No invoices found</p>
                                    </div>
                                ) : (
                                    <>
                                        {filteredLogs.map((log) => (
                                            <div key={log.id} className="flex items-center justify-between p-4 border rounded-lg">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-full border ${statusColors[log.status]}`}>
                                                        {statusIcons[log.status]}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium">{log.customer_name}</p>
                                                        <p className="text-sm text-muted-foreground">
                                                            Invoice: {log.invoice_number || 'N/A'} • UGX {log.gross_amount_ugx?.toLocaleString()}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            Tax: UGX {log.tax_amount_ugx?.toLocaleString()} • {log.submission_timestamp ? format(new Date(log.submission_timestamp), 'PPp') : 'N/A'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className={statusColors[log.status]}>
                                                        {log.status}
                                                    </Badge>
                                                    {log.status === 'failed' && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => retryMutation.mutate(log.id)}
                                                            disabled={retryMutation.isPending}
                                                        >
                                                            <RefreshCw className="w-3 h-3 mr-1" />
                                                            Retry
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        {canLoadMoreEfris && !searchTerm && statusFilter === 'all' && (
                                            <div className="pt-2 flex justify-center">
                                                <Button variant="outline" onClick={handleLoadMoreEfris} disabled={loadingMore} className="gap-2">
                                                    {loadingMore ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />}
                                                    {loadingMore ? 'Loading...' : `Load more (showing ${efrisLogs.length})`}
                                                </Button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Analytics Tab */}
                <TabsContent value="analytics" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BarChart3 className="w-5 h-5" />
                                Monthly Revenue & Tax Trend
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="revenue" name="Revenue (UGX)" fill="#10b981" />
                                    <Bar dataKey="tax" name="Tax (UGX)" fill="#f59e0b" />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Failed Tab */}
                <TabsContent value="failed" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-red-600">
                                <AlertCircle className="w-5 h-5" />
                                Failed EFRIS Invoices
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                                Invoices that failed to submit to URA EFRIS
                            </p>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {(efrisLogs || []).filter(l => l.status === 'failed').map((log) => (
                                    <div key={log.id} className="p-4 border border-red-200 rounded-lg bg-red-50">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <p className="font-medium">{log.customer_name}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    Payment: {log.payment_id} • Amount: UGX {log.gross_amount_ugx?.toLocaleString()}
                                                </p>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => retryMutation.mutate(log.id)}
                                                disabled={retryMutation.isPending || (log.retry_count || 0) >= 3}
                                            >
                                                <RefreshCw className="w-3 h-3 mr-1" />
                                                Retry ({log.retry_count || 0}/3)
                                            </Button>
                                        </div>
                                        <div className="text-sm text-red-700 bg-white p-2 rounded">
                                            <strong>Error:</strong> {log.failure_reason || log.ura_response_message}
                                        </div>
                                        {log.retry_count >= 3 && (
                                            <div className="text-xs text-red-600 mt-2">
                                                ⚠ Maximum retry attempts exceeded. Manual intervention required.
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Activity Log Tab */}
                <TabsContent value="activity-log" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Activity className="w-5 h-5" />
                                EFRIS Activity & Audit Trail
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                                Complete history of status changes, retries, and manual overrides
                            </p>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {(auditLogs || []).map((log) => (
                                    <div key={log.id} className="p-4 border rounded-lg bg-slate-50">
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-full bg-blue-100 border border-blue-300">
                                                    {log.action?.includes('retry') ? (
                                                        <RefreshCw className="w-4 h-4 text-blue-600" />
                                                    ) : log.action?.includes('override') ? (
                                                        <FileCheck className="w-4 h-4 text-blue-600" />
                                                    ) : (
                                                        <Activity className="w-4 h-4 text-blue-600" />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-medium">
                                                        {log.action?.replace('_', ' ').toUpperCase()}
                                                    </p>
                                                    <p className="text-sm text-muted-foreground">
                                                        EFRIS Invoice: {log.entity_id?.slice(-8)} • {log.details?.previous_status && `Status: ${log.details.previous_status}`}
                                                    </p>
                                                    {log.details?.user_full_name && (
                                                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                                            <User className="w-3 h-3" />
                                                            {log.details.user_full_name} ({log.details.user_email})
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <Badge variant="outline">
                                                {log.timestamp ? format(new Date(log.timestamp), 'PPp') : 'N/A'}
                                            </Badge>
                                        </div>
                                        {log.details?.notes && (
                                            <div className="mt-2 p-2 bg-white rounded border text-sm">
                                                <strong>Notes:</strong> {log.details.notes}
                                            </div>
                                        )}
                                        {log.details?.error_message && (
                                            <div className="mt-2 p-2 bg-red-50 rounded border border-red-200 text-sm text-red-700">
                                                <strong>Error:</strong> {log.details.error_message}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {(!auditLogs || auditLogs.length === 0) && (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                        <p>No activity logs found for this period</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}