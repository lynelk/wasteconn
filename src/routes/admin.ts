import { lazy } from 'react';

const Tenants = lazy(() => import('@/pages/Tenants'));
const AuditLogs = lazy(() => import('@/pages/AuditLogs'));
const RBACManagement = lazy(() => import('@/pages/RBACManagement'));
const TenantHealthMonitor = lazy(() => import('@/pages/TenantHealthMonitor'));
const SchemaEvolution = lazy(() => import('@/pages/SchemaEvolution'));
const ZoneHierarchyAdmin = lazy(() => import('@/pages/ZoneHierarchyAdmin'));

export const adminRoutes = [
  { path: '/tenants', component: Tenants, domain: 'Admin' },
  { path: '/audit-logs', component: AuditLogs, domain: 'Admin' },
  { path: '/rbac', component: RBACManagement, domain: 'Admin' },
  { path: '/tenant-health', component: TenantHealthMonitor, domain: 'Admin' },
  { path: '/schema-evolution', component: SchemaEvolution, domain: 'Admin' },
  { path: '/zone-hierarchy', component: ZoneHierarchyAdmin, domain: 'Admin' }
];
