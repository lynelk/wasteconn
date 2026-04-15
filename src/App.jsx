import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from '@/components/Layout';

// Pages
import Dashboard from '@/pages/Dashboard';
import Tenants from '@/pages/Tenants';
import ServiceZones from '@/pages/ServiceZones';
import Customers from '@/pages/Customers';
import ServicePlans from '@/pages/ServicePlans';
import Subscriptions from '@/pages/Subscriptions';
import PickupRequests from '@/pages/PickupRequests';
import Payments from '@/pages/Payments';
import Complaints from '@/pages/Complaints';
import Fleet from '@/pages/Fleet';
import Settings from '@/pages/Settings';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    else if (authError.type === 'auth_required') { navigateToLogin(); return null; }
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/tenants" element={<Tenants />} />
        <Route path="/zones" element={<ServiceZones />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/service-plans" element={<ServicePlans />} />
        <Route path="/subscriptions" element={<Subscriptions />} />
        <Route path="/pickups" element={<PickupRequests />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/complaints" element={<Complaints />} />
        <Route path="/fleet" element={<Fleet />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;