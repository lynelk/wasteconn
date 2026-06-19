// Customer-facing app routes
import { lazy } from 'react';

export const customerRoutes = [
  {
    path: '/customer-app',
    component: lazy(() => import('@/pages/CustomerApp/Dashboard')),
    label: 'Customer App',
    domain: 'customer',
  },
  {
    path: '/customer-app/pickups',
    component: lazy(() => import('@/pages/CustomerApp/Pickups')),
    label: 'My Pickups',
    domain: 'customer',
  },
  {
    path: '/customer-app/billing',
    component: lazy(() => import('@/pages/CustomerApp/Billing')),
    label: 'Billing & Payments',
    domain: 'customer',
  },
  {
    path: '/customer-app/profile',
    component: lazy(() => import('@/pages/CustomerApp/Profile')),
    label: 'Profile',
    domain: 'customer',
  },
];