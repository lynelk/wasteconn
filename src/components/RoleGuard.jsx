import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { canAccessRoute } from '@/lib/routeAccess';
import { Button } from '@/components/ui/button';

// Enforces per-route role access at the route boundary. Nav-link hiding in the
// Layout is cosmetic; this is the actual access control.
export default function RoleGuard({ path, children }) {
  const { user } = useAuth();
  const role = user?.role;

  if (canAccessRoute(path, role)) {
    return children;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <ShieldAlert className="w-12 h-12 text-muted-foreground mb-4" />
      <h1 className="text-xl font-bold font-jakarta">Access restricted</h1>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
        Your account doesn&apos;t have permission to view this page. If you believe this is a mistake, contact your administrator.
      </p>
      <Button asChild variant="outline" className="mt-5">
        <Link to="/">Back to dashboard</Link>
      </Button>
    </div>
  );
}
