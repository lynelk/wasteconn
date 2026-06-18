import { lazy } from 'react';

const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Customers = lazy(() => import('@/pages/Customers'));
const ServiceZones = lazy(() => import('@/pages/ServiceZones'));
const ServicePlans = lazy(() => import('@/pages/ServicePlans'));
const Payments = lazy(() => import('@/pages/Payments'));
const Complaints = lazy(() => import('@/pages/Complaints'));
const Analytics = lazy(() => import('@/pages/Analytics'));
const Communications = lazy(() => import('@/pages/Communications'));
const ZoneSatisfactionAnalytics = lazy(() => import('@/pages/ZoneSatisfactionAnalytics'));
const ComplianceReports = lazy(() => import('@/pages/ComplianceReports'));
const Inventory = lazy(() => import('@/pages/Inventory'));
const BillingPage = lazy(() => import('@/pages/BillingPage'));
const CircularEconomy = lazy(() => import('@/pages/CircularEconomy'));
const SyncSettingsPage = lazy(() => import('@/pages/SyncSettingsPage'));
const IntegrationHealth = lazy(() => import('@/pages/IntegrationHealth'));
const Subscriptions = lazy(() => import('@/pages/Subscriptions'));
const ExceptionsQueue = lazy(() => import('@/pages/ExceptionsQueue'));
const IntegrationQueuePage = lazy(() => import('@/pages/IntegrationQueuePage'));
const CoverageAnalytics = lazy(() => import('@/pages/CoverageAnalytics'));
const OmniInbox = lazy(() => import('@/pages/OmniInbox'));
const ReportingDashboard = lazy(() => import('@/pages/ReportingDashboard'));
const WasteBank = lazy(() => import('@/pages/WasteBank'));
const SmartBins = lazy(() => import('@/pages/SmartBins'));
const WialonIntegration = lazy(() => import('@/pages/WialonIntegration'));
const IntegrationsHub = lazy(() => import('@/pages/IntegrationsHub'));
const MarketingHub = lazy(() => import('@/pages/MarketingHub'));
const PreLaunchDashboard = lazy(() => import('@/pages/PreLaunchDashboard'));
const ServiceCatalog = lazy(() => import('@/pages/ServiceCatalog'));
const SustainabilityDashboard = lazy(() => import('@/pages/SustainabilityDashboard'));
const LoyaltyRewards = lazy(() => import('@/pages/LoyaltyRewards'));
const Redemptions = lazy(() => import('@/pages/Redemptions'));
const Settings = lazy(() => import('@/pages/Settings'));
const MyPickups = lazy(() => import('@/pages/MyPickups'));
const MyPayments = lazy(() => import('@/pages/MyPayments'));
const MyComplaints = lazy(() => import('@/pages/MyComplaints'));
const DriverDetail = lazy(() => import('@/pages/DriverDetail'));

export const authenticatedRoutes = [
  { path: '/', component: Dashboard, domain: 'Operations' },
  { path: '/customers', component: Customers, domain: 'Operations' },
  { path: '/zones', component: ServiceZones, domain: 'Operations' },
  { path: '/plans', component: ServicePlans, domain: 'Operations' },
  { path: '/payments', component: Payments, domain: 'Finance' },
  { path: '/complaints', component: Complaints, domain: 'Operations' },
  { path: '/analytics', component: Analytics, domain: 'Operations' },
  { path: '/communications', component: Communications, domain: 'Operations' },
  { path: '/satisfaction', component: ZoneSatisfactionAnalytics, domain: 'Operations' },
  { path: '/compliance', component: ComplianceReports, domain: 'Admin' },
  { path: '/inventory', component: Inventory, domain: 'Operations' },
  { path: '/billing', component: BillingPage, domain: 'Finance' },
  { path: '/circular-economy', component: CircularEconomy, domain: 'Operations' },
  { path: '/sync-settings', component: SyncSettingsPage, domain: 'Integrations' },
  { path: '/integration-health', component: IntegrationHealth, domain: 'Integrations' },
  { path: '/subscriptions', component: Subscriptions, domain: 'Finance' },
  { path: '/exceptions', component: ExceptionsQueue, domain: 'Integrations' },
  { path: '/integration-queue', component: IntegrationQueuePage, domain: 'Integrations' },
  { path: '/coverage-analytics', component: CoverageAnalytics, domain: 'Operations' },
  { path: '/omni-inbox', component: OmniInbox, domain: 'Operations' },
  { path: '/reporting', component: ReportingDashboard, domain: 'Finance' },
  { path: '/waste-bank', component: WasteBank, domain: 'Finance' },
  { path: '/smart-bins', component: SmartBins, domain: 'Operations' },
  { path: '/wialon', component: WialonIntegration, domain: 'Integrations' },
  { path: '/integrations-hub', component: IntegrationsHub, domain: 'Integrations' },
  { path: '/marketing', component: MarketingHub, domain: 'Operations' },
  { path: '/pre-launch', component: PreLaunchDashboard, domain: 'Operations' },
  { path: '/service-catalog', component: ServiceCatalog, domain: 'Operations' },
  { path: '/loyalty-rewards', component: LoyaltyRewards, domain: 'Operations' },
  { path: '/redemptions', component: Redemptions, domain: 'Operations' },
  { path: '/sustainability', component: SustainabilityDashboard, domain: 'Operations' },
  { path: '/settings', component: Settings, domain: 'Admin' },
  { path: '/my-pickups', component: MyPickups, domain: 'Public' },
  { path: '/my-payments', component: MyPayments, domain: 'Finance' },
  { path: '/my-complaints', component: MyComplaints, domain: 'Public' },
  { path: '/driver-detail', component: DriverDetail, domain: 'Operations' }
];