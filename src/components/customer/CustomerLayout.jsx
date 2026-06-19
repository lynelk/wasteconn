import React from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { Home, Truck, DollarSign, User } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
    { path: "/customer-app", icon: Home, label: "Home" },
    { path: "/customer-app/pickups", icon: Truck, label: "Pickups" },
    { path: "/customer-app/billing", icon: DollarSign, label: "Billing" },
    { path: "/customer-app/profile", icon: User, label: "Profile" },
];

export default function CustomerLayout() {
    const location = useLocation();

    return (
        <div className="min-h-screen bg-background">
            {/* Main Content */}
            <main className="pb-20">
                <Outlet />
            </main>

            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-bottom z-50">
                <div className="grid grid-cols-4">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={cn(
                                    "flex flex-col items-center justify-center py-3 px-2 transition-colors",
                                    isActive 
                                        ? "text-primary" 
                                        : "text-gray-500 hover:text-gray-700"
                                )}
                            >
                                <item.icon className={cn(
                                    "w-6 h-6 mb-1",
                                    isActive && "fill-current"
                                )} />
                                <span className="text-xs font-medium">{item.label}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
}