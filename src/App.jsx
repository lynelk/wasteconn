import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import ThemeProvider from '@/lib/ThemeProvider';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import Tenants from '@/pages/Tenants';
import Customers from '@/pages/Customers';
import ServiceZones from '@/pages/ServiceZones';
import ServicePlans from '@/pages/ServicePlans';
import PickupRequests from '@/pages/PickupRequests';
import Vehicles from '@/pages/Vehicles';
import Payments from '@/pages/Payments';
import Complaints from '@/pages/Complaints';
import Analytics from '@/pages/Analytics';
import DriverApp from '@/pages/DriverApp';
import CustomerApp from '@/pages/CustomerApp';
import Dispatch from '@/pages/Dispatch';
import AuditLogs from '@/pages/AuditLogs';
import FleetMaintenance from '@/pages/FleetMaintenance';
import Communications from '@/pages/Communications';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-4 border-secondary border-t-primary rounded-full animate-spin"></div>
          <p className="text-sm text-muted-foreground font-medium">Loading NLSWMS...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/tenants" element={<Tenants />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/zones" element={<ServiceZones />} />
        <Route path="/plans" element={<ServicePlans />} />
        <Route path="/pickups" element={<PickupRequests />} />
        <Route path="/vehicles" element={<Vehicles />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/complaints" element={<Complaints />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/dispatch" element={<Dispatch />} />
        <Route path="/audit-logs" element={<AuditLogs />} />
        <Route path="/fleet-maintenance" element={<FleetMaintenance />} />
        <Route path="/communications" element={<Communications />} />
      </Route>
      <Route path="/driver-app" element={<DriverApp />} />
      <Route path="/customer-app" element={<CustomerApp />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;