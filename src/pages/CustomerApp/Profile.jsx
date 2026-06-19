import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
    User, 
    MapPin, 
    Phone, 
    Mail, 
    Home,
    Settings,
    LogOut,
    Bell,
    Trash2
} from "lucide-react";

export default function CustomerProfile() {
    const [isEditing, setIsEditing] = useState(false);
    const [profileData, setProfileData] = useState({
        full_name: "",
        phone: "",
        email: "",
        address: "",
        preferred_language: "english"
    });

    const { data: user } = useQuery({
        queryKey: ['current-user'],
        queryFn: () => base44.auth.me()
    });

    const { data: customer } = useQuery({
        queryKey: ['customer-profile'],
        queryFn: async () => {
            const customers = await base44.entities.Customer.filter({ user_id: user?.id });
            return customers[0];
        },
        enabled: !!user
    });

    const handleSave = async () => {
        // Update customer entity
        if (customer) {
            await base44.entities.Customer.update(customer.id, profileData);
        }
        setIsEditing(false);
    };

    const handleLogout = () => {
        base44.auth.logout('/');
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background pb-24">
            {/* Header */}
            <div className="bg-primary text-primary-foreground px-6 pt-12 pb-8 rounded-b-3xl shadow-lg">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold font-jakarta">Profile</h1>
                    <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                        <Settings className="w-5 h-5" />
                    </Button>
                </div>

                {/* Profile Picture Placeholder */}
                <div className="flex flex-col items-center">
                    <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mb-4">
                        <User className="w-12 h-12 text-white" />
                    </div>
                    <h2 className="text-xl font-bold">{user?.full_name || 'Customer'}</h2>
                    <p className="text-primary-foreground/80 text-sm">{user?.email}</p>
                </div>
            </div>

            {/* Content */}
            <div className="px-6 -mt-4 space-y-4">
                {/* Account Info */}
                <Card className="border-0 shadow-md">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                            <User className="w-5 h-5 text-primary" />
                            Account Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Full Name</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    value={isEditing ? profileData.full_name : (customer?.full_name || user?.full_name || '')}
                                    onChange={(e) => setProfileData({...profileData, full_name: e.target.value})}
                                    disabled={!isEditing}
                                    className="h-12"
                                />
                                {isEditing && (
                                    <Button size="icon" variant="ghost" onClick={handleSave}>
                                        <Settings className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Email</Label>
                            <div className="flex items-center gap-2 h-12 px-3 bg-secondary rounded-md">
                                <Mail className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm">{user?.email}</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Phone</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    value={isEditing ? profileData.phone : (customer?.phone || '')}
                                    onChange={(e) => setProfileData({...profileData, phone: e.target.value})}
                                    disabled={!isEditing}
                                    className="h-12"
                                />
                                {isEditing && (
                                    <Button size="icon" variant="ghost" onClick={handleSave}>
                                        <Settings className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Service Address */}
                <Card className="border-0 shadow-md">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                            <Home className="w-5 h-5 text-primary" />
                            Service Address
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Address</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    value={isEditing ? profileData.address : (customer?.address || '')}
                                    onChange={(e) => setProfileData({...profileData, address: e.target.value})}
                                    disabled={!isEditing}
                                    className="h-12"
                                />
                                {isEditing && (
                                    <Button size="icon" variant="ghost" onClick={handleSave}>
                                        <Settings className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>
                        </div>

                        {customer?.latitude && customer?.longitude && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <MapPin className="w-4 h-4" />
                                <span>GPS: {customer.latitude.toFixed(4)}, {customer.longitude.toFixed(4)}</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Preferences */}
                <Card className="border-0 shadow-md">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                            <Bell className="w-5 h-5 text-primary" />
                            Preferences
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                            <span className="text-sm font-medium">Notifications</span>
                            <Badge variant="outline">Enabled</Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                            <span className="text-sm font-medium">Language</span>
                            <Badge variant="outline">English</Badge>
                        </div>
                    </CardContent>
                </Card>

                {/* Actions */}
                <div className="space-y-3 pt-4">
                    <Button 
                        variant="outline" 
                        className="w-full h-12"
                        onClick={() => setIsEditing(!isEditing)}
                    >
                        <Settings className="w-4 h-4 mr-2" />
                        {isEditing ? 'Cancel Editing' : 'Edit Profile'}
                    </Button>
                    <Button 
                        variant="destructive" 
                        className="w-full h-12"
                        onClick={handleLogout}
                    >
                        <LogOut className="w-4 h-4 mr-2" />
                        Logout
                    </Button>
                </div>
            </div>
        </div>
    );
}