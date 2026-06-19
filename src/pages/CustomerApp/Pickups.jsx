import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
    Truck, 
    Plus, 
    Search, 
    Calendar,
    Clock,
    CheckCircle2,
    AlertCircle,
    MapPin,
    Trash2
} from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default function CustomerPickups() {
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [newPickupOpen, setNewPickupOpen] = useState(false);
    const [newPickupData, setNewPickupData] = useState({
        request_type: "on_demand",
        waste_type: "general",
        address: "",
        notes: ""
    });

    const queryClient = useQueryClient();

    const { data: pickups = [], isLoading } = useQuery({
        queryKey: ['customer-pickups-all'],
        queryFn: () => base44.entities.PickupRequest.filter({}, '-created_date', 50)
    });

    const createPickupMutation = useMutation({
        mutationFn: (data) => base44.entities.PickupRequest.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customer-pickups-all'] });
            setNewPickupOpen(false);
            setNewPickupData({ request_type: "on_demand", waste_type: "general", address: "", notes: "" });
        }
    });

    const filteredPickups = (pickups || []).filter(pickup => {
        const matchesSearch = !searchTerm || 
            pickup.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            pickup.waste_type?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === "all" || pickup.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const statusColors = {
        pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
        scheduled: "bg-blue-100 text-blue-800 border-blue-300",
        in_progress: "bg-purple-100 text-purple-800 border-purple-300",
        completed: "bg-green-100 text-green-800 border-green-300",
        cancelled: "bg-gray-100 text-gray-800 border-gray-300"
    };

    const statusIcons = {
        pending: <Clock className="w-4 h-4" />,
        scheduled: <Calendar className="w-4 h-4" />,
        in_progress: <Truck className="w-4 h-4" />,
        completed: <CheckCircle2 className="w-4 h-4" />,
        cancelled: <AlertCircle className="w-4 h-4" />
    };

    const handleSubmit = () => {
        createPickupMutation.mutate({
            ...newPickupData,
            status: "pending",
            scheduled_date: new Date().toISOString().split('T')[0]
        });
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background pb-24">
            {/* Header */}
            <div className="bg-primary text-primary-foreground px-6 pt-12 pb-8 rounded-b-3xl shadow-lg">
                <h1 className="text-2xl font-bold font-jakarta mb-2">My Pickups</h1>
                <p className="text-primary-foreground/80 text-sm">Track and manage your waste collection requests</p>
            </div>

            {/* Content */}
            <div className="px-6 -mt-4 space-y-4">
                {/* Search & Filter */}
                <Card className="border-0 shadow-md">
                    <CardContent className="p-4 space-y-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by address or waste type..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 h-12"
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="h-12">
                                <SelectValue placeholder="Filter by status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="scheduled">Scheduled</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                        </Select>
                    </CardContent>
                </Card>

                {/* Pickup List */}
                <div className="space-y-3">
                    {isLoading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map(i => (
                                <Card key={i} className="border-0 shadow-md h-32 animate-pulse" />
                            ))}
                        </div>
                    ) : filteredPickups.length === 0 ? (
                        <Card className="border-0 shadow-md">
                            <CardContent className="py-12 text-center text-muted-foreground">
                                <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                <p className="text-sm">No pickups found</p>
                                <p className="text-xs mt-1">Request your first pickup!</p>
                            </CardContent>
                        </Card>
                    ) : (
                        filteredPickups.map((pickup) => (
                            <Card key={pickup.id} className="border-0 shadow-md">
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-full border ${statusColors[pickup.status]}`}>
                                                {statusIcons[pickup.status]}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-sm">{pickup.waste_type || 'General Waste'}</p>
                                                <p className="text-xs text-muted-foreground capitalize">{pickup.status.replace('_', ' ')}</p>
                                            </div>
                                        </div>
                                        <Badge variant="outline" className={statusColors[pickup.status]}>
                                            {pickup.status.replace('_', ' ')}
                                        </Badge>
                                    </div>
                                    
                                    <div className="space-y-2 text-sm">
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <MapPin className="w-4 h-4" />
                                            <span>{pickup.address || 'Address not set'}</span>
                                        </div>
                                        {pickup.scheduled_date && (
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Calendar className="w-4 h-4" />
                                                <span>{format(new Date(pickup.scheduled_date), 'EEEE, MMM d, yyyy')}</span>
                                            </div>
                                        )}
                                        {pickup.notes && (
                                            <p className="text-xs text-muted-foreground mt-2">{pickup.notes}</p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </div>

            {/* Floating Action Button */}
            <Dialog open={newPickupOpen} onOpenChange={setNewPickupOpen}>
                <DialogTrigger asChild>
                    <Button className="fixed bottom-24 right-6 w-14 h-14 rounded-full shadow-lg bg-primary hover:bg-primary/90">
                        <Plus className="w-6 h-6" />
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Request New Pickup</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Waste Type</Label>
                            <Select value={newPickupData.waste_type} onValueChange={(v) => setNewPickupData({...newPickupData, waste_type: v})}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="general">General Waste</SelectItem>
                                    <SelectItem value="recyclable">Recyclable</SelectItem>
                                    <SelectItem value="organic">Organic</SelectItem>
                                    <SelectItem value="bulky">Bulky Items</SelectItem>
                                    <SelectItem value="hazardous">Hazardous</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Address</Label>
                            <Input
                                placeholder="Enter pickup location"
                                value={newPickupData.address}
                                onChange={(e) => setNewPickupData({...newPickupData, address: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Notes (Optional)</Label>
                            <Textarea
                                placeholder="Additional instructions..."
                                value={newPickupData.notes}
                                onChange={(e) => setNewPickupData({...newPickupData, notes: e.target.value})}
                                className="min-h-[100px]"
                            />
                        </div>
                        <Button 
                            className="w-full h-12" 
                            onClick={handleSubmit}
                            disabled={createPickupMutation.isPending || !newPickupData.address}
                        >
                            {createPickupMutation.isPending ? "Submitting..." : "Submit Request"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}