import type { LazyExoticComponent } from 'react';
import type { ComponentType } from 'react';
import { authenticatedRoutes } from './authenticated';
import { publicRoutes } from './public';
import { adminRoutes } from './admin';
import { fieldOperationsRoutes } from './fieldOperations';

export interface AppRoute {
  path: string;
  component: LazyExoticComponent<ComponentType>;
  domain: 'Operations' | 'Finance' | 'Admin' | 'Integrations' | 'Public';
}

export { authenticatedRoutes, publicRoutes, adminRoutes, fieldOperationsRoutes };

export const routeConfig: AppRoute[] = [
  ...authenticatedRoutes,
  ...adminRoutes,
  ...fieldOperationsRoutes,
  ...publicRoutes
] as AppRoute[];
