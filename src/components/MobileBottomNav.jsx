import { useLocation, useNavigate } from 'react-router-dom';
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

// Per-tab navigation stack stored in sessionStorage
const STACKS_KEY = 'mobile_nav_stacks';

function getStacks() {
  try { return JSON.parse(sessionStorage.getItem(STACKS_KEY) || '{}'); } catch { return {}; }
}

function saveStack(tabPath, stack) {
  const stacks = getStacks();
  stacks[tabPath] = stack;
  sessionStorage.setItem(STACKS_KEY, JSON.stringify(stacks));
}

function getStackTop(tabPath) {
  const stacks = getStacks();
  const stack = stacks[tabPath];
  return stack?.length ? stack[stack.length - 1] : tabPath;
}

// Track which tab root each path belongs to
function getTabRoot(pathname, tabPaths) {
  // Exact match first
  if (tabPaths.includes(pathname)) return pathname;
  // Prefix match (e.g. /pickups/123 → /pickups)
  return tabPaths.find(tp => tp !== '/' && pathname.startsWith(tp)) || '/';
}

// Preserve scroll position per route
function useScrollPreservation(pathname) {
  const prevPath = useRef(pathname);

  useEffect(() => {
    if (prevPath.current !== pathname) {
      const main = document.querySelector('main');
      if (main) {
        sessionStorage.setItem(`scroll_${prevPath.current}`, String(main.scrollTop));
      }
      prevPath.current = pathname;
    }

    const main = document.querySelector('main');
    if (main) {
      const saved = sessionStorage.getItem(`scroll_${pathname}`);
      if (saved !== null) {
        requestAnimationFrame(() => { main.scrollTop = parseInt(saved, 10) || 0; });
      }
    }
  }, [pathname]);
}

// Push current path onto the active tab's stack whenever location changes
function useStackTracker(pathname, tabPaths) {
  const prevPath = useRef(null);

  useEffect(() => {
    if (prevPath.current === pathname) return;
    prevPath.current = pathname;

    const tabRoot = getTabRoot(pathname, tabPaths);
    const stacks = getStacks();
    const stack = stacks[tabRoot] || [tabRoot];

    // Only push if this is a new sub-path (avoid duplicating the root)
    if (stack[stack.length - 1] !== pathname) {
      stack.push(pathname);
      saveStack(tabRoot, stack);
    }
  }, [pathname, tabPaths]);
}

export default function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role || 'user';

  const visibleItems = bottomNavItems.filter(item => item.roles.includes(role));
  const tabPaths = visibleItems.map(i => i.path);

  useScrollPreservation(location.pathname);
  useStackTracker(location.pathname, tabPaths);

  const activeTab = getTabRoot(location.pathname, tabPaths);

  const handleTabPress = (tabPath) => {
    if (activeTab === tabPath) {
      // Active tab tapped → reset its stack and go to root
      saveStack(tabPath, [tabPath]);
      navigate(tabPath);
    } else {
      // Switch tab → restore last position in that tab's stack
      const destination = getStackTop(tabPath);
      navigate(destination);
    }

    // Save current scroll before leaving
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
        const isActive = activeTab === item.path;
        return (
          <button
            key={item.path}
            onClick={() => handleTabPress(item.path)}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-[10px] font-medium transition-colors",
              isActive ? "text-primary" : "text-muted-foreground"
            )}
          >
            <item.icon className={cn("w-5 h-5", isActive ? "text-primary" : "text-muted-foreground")} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}