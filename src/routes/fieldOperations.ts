import { lazy } from 'react';

const FieldApp = lazy(() => import('@/pages/FieldApp'));
const Dispatch = lazy(() => import('@/pages/Dispatch'));
const PickupRequests = lazy(() => import('@/pages/PickupRequests'));
const Vehicles = lazy(() => import('@/pages/Vehicles'));
const FleetMaintenance = lazy(() => import('@/pages/FleetMaintenance'));
const DriverPerformance = lazy(() => import('@/pages/DriverPerformance'));

export const fieldOperationsRoutes = [
  { path: '/field-app', component: FieldApp, domain: 'Operations' },
  { path: '/dispatch', component: Dispatch, domain: 'Operations' },
  { path: '/pickups', component: PickupRequests, domain: 'Operations' },
  { path: '/vehicles', component: Vehicles, domain: 'Operations' },
  { path: '/fleet-maintenance', component: FleetMaintenance, domain: 'Operations' },
  { path: '/driver-performance', component: DriverPerformance, domain: 'Operations' }
];
