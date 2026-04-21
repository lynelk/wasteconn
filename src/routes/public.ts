import { lazy } from 'react';

const CustomerApp = lazy(() => import('@/pages/CustomerApp'));
const CustomerShop = lazy(() => import('@/pages/CustomerShop'));
const PayPage = lazy(() => import('@/pages/PayPage'));

export const publicRoutes = [
  { path: '/customer-app', component: CustomerApp, domain: 'Public' },
  { path: '/customer-shop', component: CustomerShop, domain: 'Public' },
  { path: '/pay/:token', component: PayPage, domain: 'Public' }
];
