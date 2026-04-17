import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Calendar, CreditCard, MessageSquare, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import { useEffect, useRef } from 'react';

const bottomNavItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/', roles: ['admin', 'super_admin', 'dispatcher', 'driver', 'customer', 'user'] },
  { label: 'Pickups', icon: Calendar, path: '/pickups', roles: ['admin', 'super_admin', 'dispatcher', 'driver'] },
  { label: 'Payments', icon: CreditCard, path: '/payments', roles: ['admin', 'super_admin'] },
  { label: 'Complaints', icon: MessageSquare, path: '/complaints', roles: ['admin', 'super_admin', 'dispatcher'] },
  { label: 'Settings', icon: Settings, path: '/settings', roles: ['admin', 'super_admin'] },
];

// Preserve scroll position per route in sessionStorage
function useScrollPreservation(path) {
  const scrollKey = `scroll_${path}`;
  const prevPath = useRef(path);

  useEffect(() => {
    // Save scroll when leaving a tab
    if (prevPath.current !== path) {
      const main = document.querySelector('main');
      if (main) {
        sessionStorage.setItem(`scroll_${prevPath.current}`, String(main.scrollTop));
      }
      prevPath.current = path;
    }

    // Restore scroll for new tab
    const main = document.querySelector('main');
    if (main) {
      const saved = sessionStorage.getItem(scrollKey);
      if (saved !== null) {
        // Defer to after paint so content is rendered
        requestAnimationFrame(() => { main.scrollTop = parseInt(saved, 10) || 0; });
      }
    }
  }, [path, scrollKey]);
}

export default function MobileBottomNav() {
  const location = useLocation();
  const { user } = useAuth();
  const role = user?.role || 'user';

  const visibleItems = bottomNavItems.filter(item => item.roles.includes(role));

  // Save current scroll before tab switch
  useScrollPreservation(location.pathname);

  const handleTabClick = (toPath) => {
    if (toPath === location.pathname) return;
    // Save current scroll immediately on click
    const main = document.querySelector('main');
    if (main) {
      sessionStorage.setItem(`scroll_${location.pathname}`, String(main.scrollTop));
    }
  };

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border flex items-stretch"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {visibleItems.map(item => {
        const active = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => handleTabClick(item.path)}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-[10px] font-medium transition-colors",
              active ? "text-primary" : "text-muted-foreground"
            )}
          >
            <item.icon className={cn("w-5 h-5", active ? "text-primary" : "text-muted-foreground")} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}