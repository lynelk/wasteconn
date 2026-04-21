import { Suspense } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import ThemeProvider from '@/lib/ThemeProvider';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from '@/components/Layout';
import { authenticatedRoutes, adminRoutes, fieldOperationsRoutes, publicRoutes } from '@/routes';
import ErrorBoundary from '@/lib/ErrorBoundary';

const Loader = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-3">
      <div className="w-9 h-9 border-4 border-secondary border-t-primary rounded-full animate-spin"></div>
      <p className="text-sm text-muted-foreground font-medium">Loading NLSWMS...</p>
    </div>
  </div>
);
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
import CustomerApp from '@/pages/CustomerApp';
import Dispatch from '@/pages/Dispatch';
import AuditLogs from '@/pages/AuditLogs';
import FleetMaintenance from '@/pages/FleetMaintenance';
import Communications from '@/pages/Communications';
import DriverPerformance from '@/pages/DriverPerformance';
import ZoneSatisfactionAnalytics from '@/pages/ZoneSatisfactionAnalytics';
import ComplianceReports from '@/pages/ComplianceReports';
import Inventory from '@/pages/Inventory';
import FieldApp from '@/pages/FieldApp';
import BillingPage from '@/pages/BillingPage';
import CircularEconomy from '@/pages/CircularEconomy';
import CustomerShop from '@/pages/CustomerShop';
import SyncSettingsPage from '@/pages/SyncSettingsPage';
import IntegrationHealth from '@/pages/IntegrationHealth';
import Subscriptions from '@/pages/Subscriptions';
import RBACManagement from '@/pages/RBACManagement';
import TenantHealthMonitor from '@/pages/TenantHealthMonitor';
import SchemaEvolution from '@/pages/SchemaEvolution';
import ExceptionsQueue from '@/pages/ExceptionsQueue';
import IntegrationQueuePage from '@/pages/IntegrationQueuePage';
import ZoneHierarchyAdmin from '@/pages/ZoneHierarchyAdmin';
import CoverageAnalytics from '@/pages/CoverageAnalytics';
import OmniInbox from '@/pages/OmniInbox';
import ReportingDashboard from '@/pages/ReportingDashboard';
import WasteBank from '@/pages/WasteBank';
import WialonIntegration from '@/pages/WialonIntegration';
import IntegrationsHub from '@/pages/IntegrationsHub';
import MarketingHub from '@/pages/MarketingHub';
import PreLaunchDashboard from '@/pages/PreLaunchDashboard';
import PayPage from '@/pages/PayPage';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return <Loader />;
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
    if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  const layoutRoutes = [...authenticatedRoutes, ...adminRoutes, ...fieldOperationsRoutes.filter((route) => route.path !== '/field-app')];
  const standaloneFieldRoutes = fieldOperationsRoutes.filter((route) => route.path === '/field-app');

  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        <Route element={<Layout />}>
          {layoutRoutes.map((route) => (
            <Route key={route.path} path={route.path} element={<route.component />} />
          ))}
        </Route>
        {publicRoutes.map((route) => (
          <Route key={route.path} path={route.path} element={<route.component />} />
        ))}
        {standaloneFieldRoutes.map((route) => (
          <Route key={route.path} path={route.path} element={<route.component />} />
        ))}
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
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
        <Route path="/driver-performance" element={<DriverPerformance />} />
        <Route path="/satisfaction" element={<ZoneSatisfactionAnalytics />} />
        <Route path="/compliance" element={<ComplianceReports />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route path="/circular-economy" element={<CircularEconomy />} />
        <Route path="/sync-settings" element={<SyncSettingsPage />} />
        <Route path="/integration-health" element={<IntegrationHealth />} />
        <Route path="/subscriptions" element={<Subscriptions />} />
        <Route path="/rbac" element={<RBACManagement />} />
        <Route path="/tenant-health" element={<TenantHealthMonitor />} />
        <Route path="/schema-evolution" element={<SchemaEvolution />} />
        <Route path="/exceptions" element={<ExceptionsQueue />} />
        <Route path="/integration-queue" element={<IntegrationQueuePage />} />
        <Route path="/zone-hierarchy" element={<ZoneHierarchyAdmin />} />
        <Route path="/coverage-analytics" element={<CoverageAnalytics />} />
        <Route path="/omni-inbox" element={<OmniInbox />} />
        <Route path="/reporting" element={<ReportingDashboard />} />
        <Route path="/waste-bank" element={<WasteBank />} />
        <Route path="/wialon" element={<WialonIntegration />} />
        <Route path="/integrations-hub" element={<IntegrationsHub />} />
        <Route path="/marketing" element={<MarketingHub />} />
        <Route path="/pre-launch" element={<PreLaunchDashboard />} />
      </Route>
      <Route path="/field-app" element={<FieldApp />} />
      <Route path="/customer-shop" element={<CustomerShop />} />
      <Route path="/customer-app" element={<CustomerApp />} />
      <Route path="/pay/:token" element={<PayPage />} />
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
            <ErrorBoundary>
              <AuthenticatedApp />
            </ErrorBoundary>
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
