import { lazy } from 'react';

const CustomerApp = lazy(() => import('@/pages/CustomerApp'));
const CustomerShop = lazy(() => import('@/pages/CustomerShop'));

export const publicRoutes = [
  { path: '/customer-app', component: CustomerApp, domain: 'Public' },
  { path: '/customer-shop', component: CustomerShop, domain: 'Public' }
];
