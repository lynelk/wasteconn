import { useEffect, useRef } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Home, Truck, DollarSign, User } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/customer-app",          icon: Home,        label: "Home" },
  { path: "/customer-app/pickups",  icon: Truck,       label: "Pickups" },
  { path: "/customer-app/billing",  icon: DollarSign,  label: "Billing" },
  { path: "/customer-app/profile",  icon: User,        label: "Profile" },
];

const STACKS_KEY = "customer_nav_stacks";

function getStacks() {
  try { return JSON.parse(sessionStorage.getItem(STACKS_KEY) || "{}"); } catch { return {}; }
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
function getTabRoot(pathname, tabPaths) {
  if (tabPaths.includes(pathname)) return pathname;
  return tabPaths.find(tp => tp !== "/customer-app" && pathname.startsWith(tp)) || "/customer-app";
}

function useScrollPreservation(pathname) {
  const prevPath = useRef(pathname);
  useEffect(() => {
    if (prevPath.current !== pathname) {
      const main = document.querySelector("main.customer-main");
      if (main) sessionStorage.setItem(`cscroll_${prevPath.current}`, String(main.scrollTop));
      prevPath.current = pathname;
    }
    const main = document.querySelector("main.customer-main");
    if (main) {
      const saved = sessionStorage.getItem(`cscroll_${pathname}`);
      if (saved !== null) requestAnimationFrame(() => { main.scrollTop = parseInt(saved, 10) || 0; });
    }
  }, [pathname]);
}

function useStackTracker(pathname, tabPaths) {
  const prevPath = useRef(null);
  useEffect(() => {
    if (prevPath.current === pathname) return;
    prevPath.current = pathname;
    const tabRoot = getTabRoot(pathname, tabPaths);
    const stacks = getStacks();
    const stack = stacks[tabRoot] || [tabRoot];
    if (stack[stack.length - 1] !== pathname) {
      stack.push(pathname);
      saveStack(tabRoot, stack);
    }
  }, [pathname, tabPaths]);
}

export default function CustomerLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const tabPaths = navItems.map(i => i.path);

  useScrollPreservation(location.pathname);
  useStackTracker(location.pathname, tabPaths);

  const activeTab = getTabRoot(location.pathname, tabPaths);

  const handleTabPress = (tabPath) => {
    const main = document.querySelector("main.customer-main");
    if (main) sessionStorage.setItem(`cscroll_${location.pathname}`, String(main.scrollTop));

    if (activeTab === tabPath) {
      saveStack(tabPath, [tabPath]);
      navigate(tabPath);
    } else {
      navigate(getStackTop(tabPath));
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="customer-main pb-20 overflow-y-auto">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-bottom z-50">
        <div className="grid grid-cols-4">
          {navItems.map((item) => {
            const isActive = activeTab === item.path;
            return (
              <button
                key={item.path}
                onClick={() => handleTabPress(item.path)}
                className={cn(
                  "flex flex-col items-center justify-center py-3 px-2 min-h-[56px] transition-colors",
                  isActive ? "text-primary" : "text-gray-500 hover:text-gray-700"
                )}
              >
                <item.icon className={cn("w-6 h-6 mb-1", isActive && "fill-current")} />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}