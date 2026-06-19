import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
    DollarSign, 
    CreditCard, 
    Download,
    AlertCircle,
    CheckCircle2,
    Clock
} from "lucide-react";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function CustomerBilling() {
    const [selectedInvoice, setSelectedInvoice] = useState(null);

    const { data: invoices = [], isLoading } = useQuery({
        queryKey: ['customer-invoices-all'],
        queryFn: () => base44.entities.Invoice.filter({}, '-issue_date', 50)
    });

    const { data: payments = [] } = useQuery({
        queryKey: ['customer-payments'],
        queryFn: () => base44.entities.Payment.filter({}, '-payment_date', 20)
    });

    const payMutation = useMutation({
        mutationFn: (invoiceId) => base44.functions.invoke('initiateYoPayment', { invoice_id: invoiceId }),
        onSuccess: () => {
            alert('Payment initiated! Check your mobile money phone to complete the transaction.');
        }
    });

    const totalOutstanding = (invoices || []).filter(i => ['issued', 'overdue'].includes(i.status)).reduce((sum, i) => sum + (i.amount_ugx || 0), 0);
    const paidThisMonth = (payments || []).filter(p => p.status === 'completed').reduce((sum, p) => sum + (p.amount_ugx || 0), 0);

    const statusColors = {
        issued: "bg-blue-100 text-blue-800 border-blue-300",
        paid: "bg-green-100 text-green-800 border-green-300",
        overdue: "bg-red-100 text-red-800 border-red-300",
        partially_paid: "bg-yellow-100 text-yellow-800 border-yellow-300",
        cancelled: "bg-gray-100 text-gray-800 border-gray-300"
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background pb-24">
            {/* Header */}
            <div className="bg-primary text-primary-foreground px-6 pt-12 pb-8 rounded-b-3xl shadow-lg">
                <h1 className="text-2xl font-bold font-jakarta mb-2">Billing & Payments</h1>
                <p className="text-primary-foreground/80 text-sm">Manage your invoices and payments</p>
            </div>

            {/* Stats */}
            <div className="px-6 -mt-4 grid grid-cols-2 gap-3">
                <Card className="border-0 shadow-md">
                    <CardContent className="p-4">
                        <DollarSign className="w-5 h-5 text-red-600 mb-2" />
                        <p className="text-xl font-bold text-red-900">UGX {(totalOutstanding / 1000).toFixed(1)}K</p>
                        <p className="text-xs text-muted-foreground">Total Outstanding</p>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-md">
                    <CardContent className="p-4">
                        <CheckCircle2 className="w-5 h-5 text-green-600 mb-2" />
                        <p className="text-xl font-bold text-green-900">UGX {(paidThisMonth / 1000).toFixed(1)}K</p>
                        <p className="text-xs text-muted-foreground">Paid This Month</p>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <div className="px-6 mt-6">
                <Tabs defaultValue="invoices">
                    <TabsList className="w-full grid grid-cols-2 mb-4">
                        <TabsTrigger value="invoices">Invoices</TabsTrigger>
                        <TabsTrigger value="payments">Payment History</TabsTrigger>
                    </TabsList>

                    <TabsContent value="invoices" className="space-y-3">
                        {isLoading ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map(i => (
                                    <Card key={i} className="border-0 shadow-md h-32 animate-pulse" />
                                ))}
                            </div>
                        ) : (invoices || []).length === 0 ? (
                            <Card className="border-0 shadow-md">
                                <CardContent className="py-12 text-center text-muted-foreground">
                                    <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                    <p className="text-sm">No invoices found</p>
                                </CardContent>
                            </Card>
                        ) : (
                            (invoices || []).map((invoice) => (
                                <Card key={invoice.id} className="border-0 shadow-md">
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <p className="font-semibold text-sm">{invoice.invoice_number}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    Issued: {invoice.issue_date ? format(new Date(invoice.issue_date), 'MMM d, yyyy') : 'N/A'}
                                                </p>
                                                {invoice.due_date && (
                                                    <p className="text-xs text-muted-foreground">
                                                        Due: {format(new Date(invoice.due_date), 'MMM d, yyyy')}
                                                    </p>
                                                )}
                                            </div>
                                            <Badge variant="outline" className={statusColors[invoice.status]}>
                                                {invoice.status.replace('_', ' ').toUpperCase()}
                                            </Badge>
                                        </div>
                                        
                                        <div className="flex items-center justify-between mt-4">
                                            <p className="text-lg font-bold">UGX {invoice.amount_ugx?.toLocaleString()}</p>
                                            {['issued', 'overdue'].includes(invoice.status) && (
                                                <Button 
                                                    size="sm" 
                                                    className="h-10"
                                                    onClick={() => payMutation.mutate(invoice.id)}
                                                    disabled={payMutation.isPending}
                                                >
                                                    <CreditCard className="w-4 h-4 mr-2" />
                                                    {payMutation.isPending ? "Processing..." : "Pay Now"}
                                                </Button>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </TabsContent>

                    <TabsContent value="payments" className="space-y-3">
                        {(payments || []).length === 0 ? (
                            <Card className="border-0 shadow-md">
                                <CardContent className="py-12 text-center text-muted-foreground">
                                    <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                    <p className="text-sm">No payment history</p>
                                </CardContent>
                            </Card>
                        ) : (
                            (payments || []).map((payment) => (
                                <Card key={payment.id} className="border-0 shadow-md">
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <p className="font-semibold text-sm">Payment #{payment.id.slice(-8)}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {payment.payment_date ? format(new Date(payment.payment_date), 'MMM d, yyyy') : 'N/A'}
                                                </p>
                                                <p className="text-xs text-muted-foreground capitalize">
                                                    {payment.payment_method?.replace('_', ' ')}
                                                </p>
                                            </div>
                                            <Badge variant="outline" className={
                                                payment.status === 'completed' ? "bg-green-100 text-green-800 border-green-300" :
                                                payment.status === 'pending' ? "bg-yellow-100 text-yellow-800 border-yellow-300" :
                                                "bg-red-100 text-red-800 border-red-300"
                                            }>
                                                {payment.status}
                                            </Badge>
                                        </div>
                                        <p className="text-lg font-bold text-primary">UGX {payment.amount_ugx?.toLocaleString()}</p>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}