import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import PageTransition from '@/components/ui/PageTransition';
import {
  LayoutDashboard, Users, MapPin, Truck, Calendar, CreditCard,
  MessageSquare, Settings, Menu, X, LogOut,
  Building2, ClipboardList, BarChart3, Bell, User, ChevronLeft,
  Radio, Shield, Wrench, Send, TrendingUp, Star, FileCheck, Package
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import MobileBottomNav from '@/components/MobileBottomNav';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/', roles: ['admin', 'user', 'super_admin', 'dispatcher', 'driver', 'customer'] },
  { label: 'Tenants', icon: Building2, path: '/tenants', roles: ['super_admin'] },
  { label: 'Customers', icon: Users, path: '/customers', roles: ['admin', 'super_admin', 'dispatcher'] },
  { label: 'Service Zones', icon: MapPin, path: '/zones', roles: ['admin', 'super_admin', 'dispatcher'] },
  { label: 'Service Plans', icon: ClipboardList, path: '/plans', roles: ['admin', 'super_admin'] },
  { label: 'Pickup Requests', icon: Calendar, path: '/pickups', roles: ['admin', 'super_admin', 'dispatcher', 'driver'] },
  { label: 'Vehicles', icon: Truck, path: '/vehicles', roles: ['admin', 'super_admin', 'dispatcher'] },
  { label: 'Payments', icon: CreditCard, path: '/payments', roles: ['admin', 'super_admin'] },
  { label: 'Complaints', icon: MessageSquare, path: '/complaints', roles: ['admin', 'super_admin', 'dispatcher'] },
  { label: 'Analytics', icon: BarChart3, path: '/analytics', roles: ['admin', 'super_admin'] },
  { label: 'Dispatch', icon: Radio, path: '/dispatch', roles: ['admin', 'super_admin', 'dispatcher'] },
  { label: 'Fleet Maintenance', icon: Wrench, path: '/fleet-maintenance', roles: ['admin', 'super_admin'] },
  { label: 'Communications', icon: Send, path: '/communications', roles: ['admin', 'super_admin', 'dispatcher'] },
  { label: 'Driver Performance', icon: TrendingUp, path: '/driver-performance', roles: ['admin', 'super_admin'] },
  { label: 'Satisfaction', icon: Star, path: '/satisfaction', roles: ['admin', 'super_admin'] },
  { label: 'Compliance', icon: FileCheck, path: '/compliance', roles: ['admin', 'super_admin'] },
  { label: 'Inventory', icon: Package, path: '/inventory', roles: ['admin', 'super_admin', 'dispatcher'] },
  { label: 'Audit Log', icon: Shield, path: '/audit-logs', roles: ['admin', 'super_admin'] },
  { label: 'My Pickups', icon: Calendar, path: '/my-pickups', roles: ['customer'] },
  { label: 'My Payments', icon: CreditCard, path: '/my-payments', roles: ['customer'] },
  { label: 'My Complaints', icon: MessageSquare, path: '/my-complaints', roles: ['customer'] },
  { label: 'Settings', icon: Settings, path: '/settings', roles: ['admin', 'super_admin'] },
];

export default function Layout() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const role = user?.role || 'user';
  const visibleNav = navItems.filter(item => item.roles.includes(role));

  const handleLogout = () => base44.auth.logout('/');

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar flex flex-col transition-transform duration-300",
        sidebarOpen ? "translate-x-0" : "-translate-x-full",
        "lg:translate-x-0 lg:static lg:flex"
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
          <div className="w-8 h-8 bg-sidebar-primary rounded-lg flex items-center justify-center">
            <Truck className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-sidebar-primary-foreground font-jakarta">NLSWMS</p>
            <p className="text-xs text-sidebar-foreground/60">Waste Management</p>
          </div>
          <button className="ml-auto lg:hidden text-sidebar-foreground" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <div className="space-y-0.5">
            {visibleNav.map(item => {
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User */}
        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center">
              <User className="w-4 h-4 text-sidebar-accent-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-sidebar-foreground truncate">{user?.full_name || 'User'}</p>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-sidebar-border text-sidebar-foreground/60 capitalize">{role}</Badge>
            </div>
            <button onClick={handleLogout} className="text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header
          className="border-b border-border bg-card flex flex-col sticky top-0 z-30 safe-top"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="h-14 flex items-center px-4 gap-3">
            {/* Back button on mobile when not on root */}
            {location.pathname !== '/' && (
              <button
                className="lg:hidden text-muted-foreground hover:text-foreground transition-colors mr-1"
                onClick={() => navigate(-1)}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <button className="lg:hidden text-muted-foreground" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex-1" />
            <button className="text-muted-foreground hover:text-foreground transition-colors">
              <Bell className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6 pb-20 lg:pb-6">
          <AnimatePresence mode="wait">
            <PageTransition key={location.pathname}>
              <Outlet />
            </PageTransition>
          </AnimatePresence>
        </main>

        <MobileBottomNav />
      </div>
    </div>
  );
}