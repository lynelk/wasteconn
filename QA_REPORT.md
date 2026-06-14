# WasteConn — QA Review Report

_Last reviewed: 2026-06-14_

Full-codebase audit covering route/page/navigation integrity, build health, and
per-page wiring. Live click-through testing against the Base44 backend is not
possible in CI (the API proxy is disabled — `VITE_BASE44_APP_BASE_URL` unset),
so "page testing" here means: the page compiles into its lazy chunk, its imports
resolve, it is reachable via a wired route, and every navigation link resolves to
a real route. Runtime/data-dependent behaviour should additionally be smoke-tested
against a live tenant before release (see _Open items_).

## Health summary

| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run test` | ✅ 69 passed (13 files) |
| `npm run build` | ✅ clean — all routed pages emit a chunk |
| `npm run lint` (full) | ⚠️ 119 pre-existing errors (all `unused-imports`, non-blocking) |
| `npm run lint:ci` (gated subset) | ✅ clean |

## Fixed in this pass

### 1. `/settings` was a dead navigation link (404)
`Settings.jsx` is a complete, functional account page (update phone, GDPR-style
data deletion) and is linked from **both** the sidebar (`Layout.jsx`) and the
mobile bottom nav (`MobileBottomNav.jsx`) for `admin` / `super_admin` — but it
had **no route**, so every click landed on `PageNotFound`. Added
`{ path: '/settings', component: Settings, domain: 'Admin' }` to
`authenticatedRoutes`.

### 2. `/driver-app` page existed but was never wired
`DriverApp.jsx` is a full driver mobile app (offline queue, GPS tracking,
pull-to-refresh, incident reporting) — and `PreLaunchDashboard.jsx` already
lists `/driver-app` as a shipped route — but it was orphaned with no route at
all. Drivers had no way to reach it. Added `/driver-app` to
`fieldOperationsRoutes` and registered it as a **standalone** route (rendered
outside the admin `Layout`, mirroring `/field-app`) in `App.jsx`.

Both pages were previously excluded from the build (Vite only bundles imported
modules); they now compile cleanly into their own chunks.

## Resolved (follow-up pass)

### A. Customer self-service nav links — ✅ FIXED
`My Pickups` (`/my-pickups`), `My Payments` (`/my-payments`), and `My Complaints`
(`/my-complaints`) were shown to the `customer` role but had no pages/routes (all
404'd). Built three in-app pages that render inside `Layout` for the customer
role, sharing a new `useMyCustomer()` hook (resolves the Customer by signed-in
email) and reusing existing pieces (`CustomerPickupModal`, `TrackDispatchModal`,
`CustomerInvoiceCard`, `CustomerStatementModal`). Routes registered in
`authenticatedRoutes`.

### B. `Fleet.jsx` redundant orphan — ✅ FIXED
Deleted `Fleet.jsx` (unrouted duplicate of `Vehicles.jsx`). Folded its two unique
bits — a status filter and a tenant-name column — into `Vehicles.jsx`.

## Open items (recommendations — need a product decision)

### C. Lint debt — `LOW`
`npm run lint` reports 119 errors, all `unused-imports/no-unused-imports` across
many pages (unused icon/component imports). CI only gates a subset (`lint:ci`),
so these don't fail the build, but they add noise. **Recommendation:** run
`npm run lint:fix` and review, then consider widening `lint:ci` coverage.

### D. Live smoke test before release — `INFO`
Data-driven behaviour (entity reads/writes, Base44 functions like
`fillLevelRouteOptimiser`, payments, offline sync) can't be exercised in CI
without a live backend. Recommend a manual smoke pass per domain
(Operations / Finance / Admin / Integrations / Public) against a seeded tenant.

## Page inventory

All **47** routed pages compile and are reachable:

- **Operations:** Dashboard, PickupRequests, Dispatch, SmartBins, OmniInbox,
  Communications, WasteBank, CircularEconomy, Customers, ServiceZones,
  ServicePlans, Vehicles, FleetMaintenance, DriverPerformance, Complaints,
  ZoneSatisfactionAnalytics, Analytics, CoverageAnalytics, MarketingHub,
  PreLaunchDashboard
- **Finance:** Payments, BillingPage, Subscriptions, Inventory, ReportingDashboard
- **Admin:** Tenants, AuditLogs, RBACManagement, TenantHealthMonitor,
  SchemaEvolution, ZoneHierarchyAdmin, ComplianceReports, Settings
- **Integrations:** SyncSettingsPage, IntegrationHealth, ExceptionsQueue,
  IntegrationQueuePage, IntegrationsHub, WialonIntegration
- **Field / standalone:** FieldApp, DriverApp
- **Public:** CustomerApp, CustomerShop, PayPage
- **Customer self-service:** MyPickups, MyPayments, MyComplaints _(newly built)_
