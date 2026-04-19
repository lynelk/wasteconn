import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import PageTransition from '@/components/ui/PageTransition';
import {
  LayoutDashboard, Users, MapPin, Truck, Calendar, CreditCard,
  MessageSquare, Settings, Menu, X, LogOut,
  Building2, ClipboardList, BarChart3, User, ChevronLeft, ChevronDown,
  Radio, Shield, Wrench, Send, TrendingUp, Star, FileCheck, Package,
  Activity, Database, Lock, AlertTriangle, Zap, GitBranch, Inbox, Scale,
  FileBarChart, PlugZap, RefreshCw, Recycle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import MobileBottomNav from '@/components/MobileBottomNav';
import NotificationCenter from '@/components/notifications/NotificationCenter';

const navGroups = [
  {
    label: null, // No header — top-level items
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, path: '/', roles: ['admin', 'user', 'super_admin', 'dispatcher', 'driver', 'customer'] },
      { label: 'Tenants', icon: Building2, path: '/tenants', roles: ['super_admin'] },
    ]
  },
  {
    label: 'Operations',
    icon: Calendar,
    roles: ['admin', 'super_admin', 'dispatcher', 'driver'],
    items: [
      { label: 'Pickup Requests', icon: Calendar, path: '/pickups', roles: ['admin', 'super_admin', 'dispatcher', 'driver'] },
      { label: 'Dispatch', icon: Radio, path: '/dispatch', roles: ['admin', 'super_admin', 'dispatcher'] },
      { label: 'Omni-Inbox', icon: Inbox, path: '/omni-inbox', roles: ['admin', 'super_admin', 'dispatcher'] },
      { label: 'Communications', icon: Send, path: '/communications', roles: ['admin', 'super_admin', 'dispatcher'] },
      { label: 'Waste Bank', icon: Scale, path: '/waste-bank', roles: ['admin', 'super_admin', 'dispatcher'] },
      { label: 'Circular Economy', icon: Recycle, path: '/circular-economy', roles: ['admin', 'super_admin', 'dispatcher'] },
    ]
  },
  {
    label: 'Customers & Zones',
    icon: Users,
    roles: ['admin', 'super_admin', 'dispatcher'],
    items: [
      { label: 'Customers', icon: Users, path: '/customers', roles: ['admin', 'super_admin', 'dispatcher'] },
      { label: 'Service Zones', icon: MapPin, path: '/zones', roles: ['admin', 'super_admin', 'dispatcher'] },
      { label: 'Zone Hierarchy', icon: GitBranch, path: '/zone-hierarchy', roles: ['admin', 'super_admin'] },
      { label: 'Service Plans', icon: ClipboardList, path: '/plans', roles: ['admin', 'super_admin'] },
    ]
  },
  {
    label: 'Fleet & Drivers',
    icon: Truck,
    roles: ['admin', 'super_admin', 'dispatcher'],
    items: [
      { label: 'Vehicles', icon: Truck, path: '/vehicles', roles: ['admin', 'super_admin', 'dispatcher'] },
      { label: 'Fleet Maintenance', icon: Wrench, path: '/fleet-maintenance', roles: ['admin', 'super_admin'] },
      { label: 'Driver Performance', icon: TrendingUp, path: '/driver-performance', roles: ['admin', 'super_admin'] },
    ]
  },
  {
    label: 'Finance',
    icon: CreditCard,
    roles: ['admin', 'super_admin'],
    items: [
      { label: 'Payments', icon: CreditCard, path: '/payments', roles: ['admin', 'super_admin'] },
      { label: 'Billing', icon: FileBarChart, path: '/billing', roles: ['admin', 'super_admin'] },
      { label: 'Subscriptions', icon: ClipboardList, path: '/subscriptions', roles: ['admin', 'super_admin'] },
      { label: 'Inventory', icon: Package, path: '/inventory', roles: ['admin', 'super_admin', 'dispatcher'] },
    ]
  },
  {
    label: 'Service Quality',
    icon: Star,
    roles: ['admin', 'super_admin', 'dispatcher'],
    items: [
      { label: 'Complaints', icon: MessageSquare, path: '/complaints', roles: ['admin', 'super_admin', 'dispatcher'] },
      { label: 'Satisfaction', icon: Star, path: '/satisfaction', roles: ['admin', 'super_admin'] },
      { label: 'Compliance', icon: FileCheck, path: '/compliance', roles: ['admin', 'super_admin'] },
    ]
  },
  {
    label: 'Analytics & Reports',
    icon: BarChart3,
    roles: ['admin', 'super_admin'],
    items: [
      { label: 'Analytics', icon: BarChart3, path: '/analytics', roles: ['admin', 'super_admin'] },
      { label: 'Reporting', icon: FileBarChart, path: '/reporting', roles: ['admin', 'super_admin'] },
    ]
  },
  {
    label: 'Settings & Admin',
    icon: Settings,
    roles: ['admin', 'super_admin'],
    items: [
      { label: 'RBAC Management', icon: Lock, path: '/rbac', roles: ['super_admin'] },
      { label: 'Tenant Health', icon: Activity, path: '/tenant-health', roles: ['super_admin'] },
      { label: 'Schema Evolution', icon: Database, path: '/schema-evolution', roles: ['super_admin'] },
      { label: 'System Settings', icon: Settings, path: '/sync-settings', roles: ['super_admin'] },
      { label: 'Audit Log', icon: Shield, path: '/audit-logs', roles: ['admin', 'super_admin'] },
      { label: 'Exceptions Queue', icon: AlertTriangle, path: '/exceptions', roles: ['admin', 'super_admin', 'dispatcher'] },
      { label: 'Integration Queue', icon: Zap, path: '/integration-queue', roles: ['admin', 'super_admin'] },
      { label: 'Integration Health', icon: RefreshCw, path: '/integration-health', roles: ['admin', 'super_admin'] },
      { label: 'Integrations Hub', icon: PlugZap, path: '/integrations-hub', roles: ['admin', 'super_admin'] },
    ]
  },
  // Customer-only items
  {
    label: null,
    items: [
      { label: 'My Pickups', icon: Calendar, path: '/my-pickups', roles: ['customer'] },
      { label: 'My Payments', icon: CreditCard, path: '/my-payments', roles: ['customer'] },
      { label: 'My Complaints', icon: MessageSquare, path: '/my-complaints', roles: ['customer'] },
      { label: 'Settings', icon: Settings, path: '/settings', roles: ['admin', 'super_admin'] },
    ]
  }
];

function NavGroup({ group, role, location, onNavigate, defaultOpen }) {
  const hasVisibleItem = group.items.some(item => item.roles.includes(role));
  if (!hasVisibleItem) return null;

  // Ungrouped (no label)
  if (!group.label) {
    return (
      <div className="space-y-0.5 mb-1">
        {group.items.filter(item => item.roles.includes(role)).map(item => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
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
    );
  }

  const isGroupActive = group.items.some(item => location.pathname === item.path);
  const [open, setOpen] = useState(defaultOpen || isGroupActive);
  const visibleItems = group.items.filter(item => item.roles.includes(role));
  const GroupIcon = group.icon;

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all",
          isGroupActive
            ? "text-sidebar-primary bg-sidebar-accent/60"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
      >
        <GroupIcon className="w-4 h-4 shrink-0" />
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", open ? "rotate-180" : "")} />
      </button>
      {open && (
        <div className="mt-0.5 ml-3 pl-3 border-l border-sidebar-border/40 space-y-0.5">
          {visibleItems.map(item => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="w-3.5 h-3.5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const role = user?.role || 'user';
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
          {navGroups.map((group, idx) => (
            <NavGroup
              key={idx}
              group={group}
              role={role}
              location={location}
              onNavigate={() => setSidebarOpen(false)}
            />
          ))}
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
            <NotificationCenter />
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