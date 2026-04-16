import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Seed Foundation Data
 * Creates initial City tenant, Operator tenant, and system RBAC roles.
 * Idempotent - safe to run multiple times.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    const results = { tenants: [], roles: [] };

    // --- Seed Tenants ---
    const existingTenants = await base44.asServiceRole.entities.Tenant.list();
    const hasCityTenant = existingTenants.some(t => t.tenant_type === 'city');
    const hasOperatorTenant = existingTenants.some(t => t.tenant_type === 'operator');

    let cityTenant;
    if (!hasCityTenant) {
      cityTenant = await base44.asServiceRole.entities.Tenant.create({
        company_name: 'Kampala Capital City Authority',
        slug: 'kcca',
        tenant_type: 'city',
        contact_email: 'admin@kcca.go.ug',
        contact_phone: '+256414234567',
        address: 'City Square, Kampala',
        district: 'Kampala',
        districts_served: ['Kampala','Wakiso','Mukono'],
        status: 'active',
        subscription_plan: 'premium',
        admin_email: 'admin@kcca.go.ug',
        isolation_enforced: true,
        health_score: 100,
        notes: 'Seeded City Authority tenant',
      });
      results.tenants.push({ type: 'city', name: cityTenant.company_name, id: cityTenant.id });
    } else {
      cityTenant = existingTenants.find(t => t.tenant_type === 'city');
      results.tenants.push({ type: 'city', name: cityTenant.company_name, id: cityTenant.id, note: 'already exists' });
    }

    if (!hasOperatorTenant) {
      const operatorTenant = await base44.asServiceRole.entities.Tenant.create({
        company_name: 'GreenWave Waste Solutions Ltd',
        slug: 'greenwave',
        tenant_type: 'operator',
        parent_city_tenant_id: cityTenant?.id || '',
        contact_email: 'admin@greenwave.co.ug',
        contact_phone: '+256772000001',
        address: 'Industrial Area, Kampala',
        district: 'Kampala',
        districts_served: ['Kampala','Wakiso'],
        status: 'active',
        subscription_plan: 'standard',
        admin_email: 'admin@greenwave.co.ug',
        isolation_enforced: true,
        health_score: 100,
        notes: 'Seeded Operator tenant',
      });
      results.tenants.push({ type: 'operator', name: operatorTenant.company_name, id: operatorTenant.id });
    } else {
      const op = existingTenants.find(t => t.tenant_type === 'operator');
      results.tenants.push({ type: 'operator', name: op.company_name, id: op.id, note: 'already exists' });
    }

    // --- Seed System RBAC Roles ---
    const existingRoles = await base44.asServiceRole.entities.RBACRole.list();
    const existingRoleTypes = new Set(existingRoles.filter(r => r.is_system_role).map(r => r.role_type));

    const systemRoles = [
      {
        role_name: 'Super Administrator',
        role_type: 'super_admin',
        description: 'Full platform access across all tenants',
        scopes: ['tenant:*'],
        permissions: ['*'],
        is_system_role: true,
      },
      {
        role_name: 'City Administrator',
        role_type: 'city_admin',
        description: 'Full access within city tenant; read access to all operator data',
        scopes: ['tenant:city', 'tenant:operator:read'],
        permissions: ['customers:read','customers:write','invoices:read','invoices:write','reports:read','reports:write','analytics:read','zones:read','zones:write','compliance:read','compliance:write','audit:read','operators:read'],
        is_system_role: true,
      },
      {
        role_name: 'City Analyst',
        role_type: 'city_analyst',
        description: 'Read-only cross-operator analytics and compliance reporting',
        scopes: ['tenant:city:read', 'tenant:operator:read'],
        permissions: ['analytics:read','reports:read','compliance:read','customers:read','invoices:read'],
        is_system_role: true,
      },
      {
        role_name: 'Operator Administrator',
        role_type: 'operator_admin',
        description: 'Full access within their operator tenant only',
        scopes: ['tenant:own'],
        permissions: ['customers:read','customers:write','invoices:read','invoices:write','payments:read','payments:write','jobs:read','jobs:write','jobs:complete','routes:read','routes:write','vehicles:read','vehicles:write','zones:read','reports:read','analytics:read','audit:read'],
        is_system_role: true,
      },
      {
        role_name: 'Operator Manager',
        role_type: 'operator_manager',
        description: 'Manages operations within assigned zones/branches',
        scopes: ['zone:assigned', 'branch:assigned'],
        permissions: ['customers:read','customers:write','jobs:read','jobs:write','routes:read','routes:write','vehicles:read','invoices:read','payments:read','analytics:read'],
        is_system_role: true,
      },
      {
        role_name: 'Dispatcher',
        role_type: 'dispatcher',
        description: 'Route planning and job dispatch',
        scopes: ['zone:assigned'],
        permissions: ['jobs:read','jobs:write','jobs:assign','routes:read','routes:write','vehicles:read','customers:read'],
        is_system_role: true,
      },
      {
        role_name: 'Driver / Field Collector',
        role_type: 'driver',
        description: 'Access to assigned jobs and route navigation',
        scopes: ['zone:assigned', 'jobs:own'],
        permissions: ['jobs:read','jobs:update','jobs:complete','evidence:upload','location:update'],
        is_system_role: true,
      },
      {
        role_name: 'Field Agent',
        role_type: 'field_agent',
        description: 'Customer onboarding and field operations',
        scopes: ['zone:assigned'],
        permissions: ['customers:read','customers:write','jobs:read','complaints:read','complaints:write'],
        is_system_role: true,
      },
      {
        role_name: 'Billing Officer',
        role_type: 'billing_officer',
        description: 'Invoice and payment management',
        scopes: ['tenant:own'],
        permissions: ['invoices:read','invoices:write','payments:read','payments:write','receipts:read','receipts:write','statements:read','customers:read'],
        is_system_role: true,
      },
      {
        role_name: 'Compliance Officer',
        role_type: 'compliance_officer',
        description: 'Compliance reporting and audit review',
        scopes: ['tenant:own'],
        permissions: ['compliance:read','compliance:write','audit:read','reports:read','reports:write','evidence:read'],
        is_system_role: true,
      },
      {
        role_name: 'Customer',
        role_type: 'customer',
        description: 'Self-service portal access for own data only',
        scopes: ['customer:own'],
        permissions: ['pickups:request','invoices:own:read','payments:own:read','complaints:own:write','profile:own:update'],
        is_system_role: true,
      },
      {
        role_name: 'Support Agent',
        role_type: 'support_agent',
        description: 'Customer support and complaint resolution',
        scopes: ['tenant:own'],
        permissions: ['customers:read','complaints:read','complaints:write','jobs:read','invoices:read'],
        is_system_role: true,
      },
      {
        role_name: 'Read-Only Auditor',
        role_type: 'readonly',
        description: 'Read-only access to all non-sensitive data',
        scopes: ['tenant:own:read'],
        permissions: ['customers:read','invoices:read','payments:read','reports:read','analytics:read','audit:read'],
        is_system_role: true,
      },
    ];

    for (const role of systemRoles) {
      if (!existingRoleTypes.has(role.role_type)) {
        const created = await base44.asServiceRole.entities.RBACRole.create({ ...role, status: 'active' });
        results.roles.push({ created: true, name: role.role_name, id: created.id });
      } else {
        results.roles.push({ created: false, name: role.role_name, note: 'already exists' });
      }
    }

    return Response.json({
      success: true,
      message: 'Foundation data seeded successfully',
      results,
      summary: `${results.tenants.filter(t => !t.note).length} tenants created, ${results.roles.filter(r => r.created).length} RBAC roles created.`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});