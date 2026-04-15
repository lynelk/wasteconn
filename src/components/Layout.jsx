import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import {
  LayoutDashboard, Users, MapPin, Trash2, CreditCard,
  MessageSquare, Truck, Settings, LogOut, Menu, X,
  Building2, ClipboardList, ChevronDown, Bell
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const navGroups = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
    ]
  },
  {
    label: 'Operations',
    items: [
      { label: 'Pickup Requests', icon: ClipboardList, path: '/pickups' },
      { label: 'Fleet', icon: Truck, path: '/fleet' },
      { label: 'Service Zones', icon: MapPin, path: '/zones' },
    ]
  },
  {
    label: 'Customers',
    items: [
      { label: 'Customers', icon: Users, path: '/customers' },
      { label: 'Subscriptions', icon: Trash2, path: '/subscriptions' },
      { label: 'Payments', icon: CreditCard, path: '/payments' },
      { label: 'Complaints', icon: MessageSquare, path: '/complaints' },
    ]
  },
  {
    label: 'Administration',
    items: [
      { label: 'Tenants', icon: Building2, path: '/tenants' },
      { label: 'Service Plans', icon: ClipboardList, path: '/service-plans' },
      { label: 'Settings', icon: Settings, path: '/settings' },
    ]
  }
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleLogout = () => base44.auth.logout('/');

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 z-30 w-64 bg-sidebar flex flex-col transition-transform duration-300",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Trash2 className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <p className="font-jakarta font-bold text-sm text-sidebar-foreground">NLSWMS</p>
            <p className="text-xs text-sidebar-foreground/50">Waste Management</p>
          </div>
          <button className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="w-4 h-4 text-sidebar-foreground" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {navGroups.map(group => (
            <div key={group.label}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 px-2 mb-1">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map(item => {
                  const active = location.pathname === item.path;
                  return (
                    <li key={item.path}>
                      <Link
                        to={item.path}
                        onClick={() => setSidebarOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                          active
                            ? "bg-sidebar-primary text-sidebar-primary-foreground"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <item.icon className="w-4 h-4 shrink-0" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-sidebar-border px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-xs font-bold text-primary">{user?.full_name?.[0] || 'U'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-sidebar-foreground truncate">{user?.full_name || 'User'}</p>
              <p className="text-[10px] text-sidebar-foreground/50 truncate">{user?.role || 'admin'}</p>
            </div>
            <button onClick={handleLogout} className="text-sidebar-foreground/50 hover:text-sidebar-foreground">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-14 border-b bg-card flex items-center px-4 gap-3 shrink-0">
          <button className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <button className="relative p-2 rounded-lg hover:bg-muted">
            <Bell className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-xs font-bold text-primary">{user?.full_name?.[0] || 'U'}</span>
            </div>
            <span className="hidden sm:block font-medium text-sm">{user?.full_name}</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}