// Single source of truth for route-level authorization.
// The Layout hides nav links by role, but that is cosmetic — these roles are
// enforced at the route boundary by <RoleGuard> so a signed-in user cannot
// reach a page by typing its URL. Paths not listed here are available to any
// authenticated user (e.g. the dashboard).

export const ROUTE_ROLES = {
  '/tenants': ['super_admin'],
  '/pickups': ['admin', 'super_admin', 'dispatcher', 'driver'],
  '/dispatch': ['admin', 'super_admin', 'dispatcher'],
  '/smart-bins': ['admin', 'super_admin', 'dispatcher'],
  '/omni-inbox': ['admin', 'super_admin', 'dispatcher'],
  '/communications': ['admin', 'super_admin', 'dispatcher'],
  '/waste-bank': ['admin', 'super_admin', 'dispatcher'],
  '/circular-economy': ['admin', 'super_admin', 'dispatcher'],
  '/customers': ['admin', 'super_admin', 'dispatcher'],
  '/zones': ['admin', 'super_admin', 'dispatcher'],
  '/zone-hierarchy': ['admin', 'super_admin'],
  '/plans': ['admin', 'super_admin'],
  '/service-catalog': ['admin', 'super_admin'],
  '/vehicles': ['admin', 'super_admin', 'dispatcher'],
  '/fleet-maintenance': ['admin', 'super_admin'],
  '/driver-performance': ['admin', 'super_admin'],
  '/payments': ['admin', 'super_admin'],
  '/billing': ['admin', 'super_admin'],
  '/subscriptions': ['admin', 'super_admin'],
  '/inventory': ['admin', 'super_admin', 'dispatcher'],
  '/marketing': ['admin', 'super_admin'],
  '/complaints': ['admin', 'super_admin', 'dispatcher'],
  '/satisfaction': ['admin', 'super_admin'],
  '/compliance': ['admin', 'super_admin'],
  '/analytics': ['admin', 'super_admin'],
  '/reporting': ['admin', 'super_admin'],
  '/sustainability': ['admin', 'super_admin'],
  '/rbac': ['super_admin'],
  '/tenant-health': ['super_admin'],
  '/schema-evolution': ['super_admin'],
  '/sync-settings': ['super_admin'],
  '/settings': ['admin', 'super_admin'],
  '/audit-logs': ['admin', 'super_admin'],
  '/exceptions': ['admin', 'super_admin', 'dispatcher'],
  '/integration-queue': ['admin', 'super_admin'],
  '/integration-health': ['admin', 'super_admin'],
  '/integrations-hub': ['admin', 'super_admin'],
  '/pre-launch': ['super_admin'],
  '/my-pickups': ['customer'],
  '/my-payments': ['customer'],
  '/my-complaints': ['customer'],
  // Field/driver apps
  '/field-app': ['admin', 'super_admin', 'dispatcher', 'driver'],
  '/driver-app': ['admin', 'super_admin', 'dispatcher', 'driver'],
};

// Returns true when the role may access the path. Unlisted paths are open to
// any authenticated user; super_admin can access everything.
export function canAccessRoute(path, role) {
  const allowed = ROUTE_ROLES[path];
  if (!allowed) return true;
  if (role === 'super_admin') return true;
  return allowed.includes(role);
}
