import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
    Truck, 
    DollarSign, 
    Calendar, 
    Bell, 
    Plus, 
    Clock,
    CheckCircle2,
    AlertCircle,
    ChevronRight
} from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";

export default function CustomerDashboard() {
    const { data: pickups = [] } = useQuery({
        queryKey: ['customer-pickups'],
        queryFn: () => base44.entities.PickupRequest.filter({ status: { $in: ['pending', 'scheduled', 'in_progress'] } }, '-scheduled_date', 10)
    });

    const { data: invoices = [] } = useQuery({
        queryKey: ['customer-invoices'],
        queryFn: () => base44.entities.Invoice.filter({ status: { $in: ['issued', 'overdue'] } }, '-issue_date', 5)
    });

    const upcomingPickups = pickups.filter(p => ['pending', 'scheduled'].includes(p.status));
    const overdueInvoices = invoices.filter(i => i.status === 'overdue');

    const statusColors = {
        pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
        scheduled: "bg-blue-100 text-blue-800 border-blue-300",
        in_progress: "bg-purple-100 text-purple-800 border-purple-300",
        completed: "bg-green-100 text-green-800 border-green-300"
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background pb-24">
            {/* Header */}
            <div className="bg-primary text-primary-foreground px-6 pt-12 pb-24 rounded-b-3xl shadow-lg">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold font-jakarta">Welcome Back!</h1>
                        <p className="text-primary-foreground/80 text-sm">Manage your waste services</p>
                    </div>
                    <Button variant="ghost" size="icon" className="bg-white/10 hover:bg-white/20 text-white">
                        <Bell className="w-5 h-5" />
                    </Button>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-3">
                    <Card className="bg-white/10 border-white/20 text-white">
                        <CardContent className="p-4">
                            <Truck className="w-6 h-6 mb-2 text-white/80" />
                            <p className="text-2xl font-bold">{upcomingPickups.length}</p>
                            <p className="text-xs text-white/70">Upcoming Pickups</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-white/10 border-white/20 text-white">
                        <CardContent className="p-4">
                            <DollarSign className="w-6 h-6 mb-2 text-white/80" />
                            <p className="text-2xl font-bold">{overdueInvoices.length}</p>
                            <p className="text-xs text-white/70">Outstanding Bills</p>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Main Content */}
            <div className="px-6 -mt-16 space-y-6">
                {/* Quick Actions */}
                <Card className="border-0 shadow-lg">
                    <CardContent className="p-4">
                        <div className="grid grid-cols-2 gap-3">
                            <Link to="/customer-app/pickups">
                                <Button className="w-full h-20 flex flex-col gap-2 bg-primary hover:bg-primary/90">
                                    <Plus className="w-6 h-6" />
                                    <span className="text-sm font-medium">Request Pickup</span>
                                </Button>
                            </Link>
                            <Link to="/customer-app/billing">
                                <Button className="w-full h-20 flex flex-col gap-2 bg-accent hover:bg-accent/90 text-accent-foreground">
                                    <DollarSign className="w-6 h-6" />
                                    <span className="text-sm font-medium">Pay Bills</span>
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>

                {/* Upcoming Pickups */}
                <Card className="border-0 shadow-lg">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-primary" />
                                Upcoming Pickups
                            </CardTitle>
                            <Link to="/customer-app/pickups" className="text-sm text-primary flex items-center gap-1">
                                View All <ChevronRight className="w-4 h-4" />
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {upcomingPickups.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                <p className="text-sm">No upcoming pickups</p>
                            </div>
                        ) : (
                            upcomingPickups.slice(0, 3).map((pickup) => (
                                <div key={pickup.id} className="p-4 bg-secondary/50 rounded-xl border border-secondary">
                                    <div className="flex items-center justify-between mb-2">
                                        <Badge className={statusColors[pickup.status]}>
                                            {pickup.status.replace('_', ' ')}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                            {pickup.scheduled_date ? format(new Date(pickup.scheduled_date), 'MMM d') : 'TBD'}
                                        </span>
                                    </div>
                                    <p className="font-medium text-sm mb-1">{pickup.waste_type || 'General Waste'}</p>
                                    <p className="text-xs text-muted-foreground">{pickup.address || 'Address not set'}</p>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>

                {/* Outstanding Invoices */}
                <Card className="border-0 shadow-lg">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                <DollarSign className="w-5 h-5 text-accent" />
                                Outstanding Bills
                            </CardTitle>
                            <Link to="/customer-app/billing" className="text-sm text-primary flex items-center gap-1">
                                View All <ChevronRight className="w-4 h-4" />
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {overdueInvoices.length === 0 ? (
                            <div className="text-center py-8 text-green-600">
                                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                <p className="text-sm font-medium">All bills paid!</p>
                            </div>
                        ) : (
                            overdueInvoices.slice(0, 3).map((invoice) => (
                                <div key={invoice.id} className="p-4 bg-red-50 rounded-xl border border-red-200">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <AlertCircle className="w-4 h-4 text-red-600" />
                                            <span className="text-sm font-medium text-red-800">Overdue</span>
                                        </div>
                                        <span className="text-xs text-red-600">
                                            Due: {invoice.due_date ? format(new Date(invoice.due_date), 'MMM d') : 'N/A'}
                                        </span>
                                    </div>
                                    <p className="font-bold text-lg text-red-900">UGX {invoice.amount_ugx?.toLocaleString()}</p>
                                    <p className="text-xs text-red-700 mt-1">{invoice.invoice_number}</p>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}