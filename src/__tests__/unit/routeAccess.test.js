import { describe, it, expect } from 'vitest';
import { canAccessRoute, ROUTE_ROLES } from '@/lib/routeAccess';

describe('canAccessRoute', () => {
  it('allows unlisted paths for any authenticated role', () => {
    expect(canAccessRoute('/', 'customer')).toBe(true);
    expect(canAccessRoute('/some-unlisted-page', 'driver')).toBe(true);
  });

  it('blocks roles not in the allow-list for restricted paths', () => {
    expect(canAccessRoute('/service-catalog', 'customer')).toBe(false);
    expect(canAccessRoute('/sustainability', 'driver')).toBe(false);
    expect(canAccessRoute('/smart-bins', 'customer')).toBe(false);
  });

  it('permits roles that are in the allow-list', () => {
    expect(canAccessRoute('/service-catalog', 'admin')).toBe(true);
    expect(canAccessRoute('/smart-bins', 'dispatcher')).toBe(true);
    expect(canAccessRoute('/my-pickups', 'customer')).toBe(true);
  });

  it('lets super_admin access everything', () => {
    for (const path of Object.keys(ROUTE_ROLES)) {
      expect(canAccessRoute(path, 'super_admin')).toBe(true);
    }
  });
});
