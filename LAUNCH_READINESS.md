# WasteConn — Launch & Scale Readiness Assessment

_Assessed: 2026-06-14 · Target: production launch, scaling toward 10,000,000 users_

## 1. Pending implementations

**None outstanding.** A full scan found no `TODO`/`FIXME`/`HACK`/`WIP` markers,
no empty handlers (`onClick={() => {}}`), no `throw "not implemented"`, and no
placeholder/stub components in `src/`. The `pending` entries in
`PreLaunchDashboard.jsx` are **runtime readiness probes** (they execute live
checks against the backend), not unfinished code. All 47 routed pages compile
and are reachable (see `QA_REPORT.md`).

Verification baseline: `typecheck` clean · `test` 69 passed · `build` clean.

## 2. Verdict

WasteConn is **functionally launch-ready for a pilot / single-city rollout**, and
the architecture (React + Vite + React Query on the Base44 BaaS, lazy-loaded
routes, multi-tenant entities, RBAC, offline field/driver apps) is sound.

It is **not yet ready for 10M users without remediation.** The blockers are not
missing features — they are **data-access patterns, observability, and
load-validation** that must change before high scale. None are architectural
rewrites; they are systematic hardening passes.

## 3. Readiness scorecard

| Area | State | Grade |
|---|---|---|
| Feature completeness | All pages built & wired | 🟢 Ready |
| Build / code-splitting | Lazy routes, 133 chunks, ~2.7 MB total JS | 🟢 Good |
| Client data fetching at scale | 77 unbounded `.list()` calls | 🔴 Blocker |
| Server-side pagination/search | SDK supports it; inconsistently applied | 🟡 Partial |
| Observability / monitoring | Custom logger + ErrorBoundary; no APM | 🔴 Blocker |
| Load / soak testing | None evident | 🔴 Blocker |
| Automated test coverage | 69 unit tests; e2e dir is a stub | 🟡 Partial |
| Security / tenant isolation | RBAC + audit + isolation checks present | 🟡 Verify |
| Multi-region / locale | UGX + Kampala fallbacks hard-coded | 🟡 Single-region |

## 4. P0 — must fix before high scale

### 4.1 Unbounded `entity.list()` calls (the #1 blocker)
77 call sites fetch **entire tables** into the browser, e.g.
`base44.entities.Customer.list()` in `Customers`, `Subscriptions`, `MarketingHub`,
`Complaints`, and in many form dropdowns (`PaymentForm`, `PickupForm`,
`ComplaintForm`, `CustomerForm`…). At 10M customers a single page would try to
download millions of rows — the tab will hang or crash, and the backend/egress
cost is enormous.

The SDK already supports bounds — `entity.list(sort, limit)` and
`entity.filter(query, sort, limit)` — and some screens use them
(`Subscriptions` 300, `WasteBank` 200, `ExceptionsQueue` 100, `NotificationCenter`
30). The fix is to make this **universal**:

- **Lists/tables:** server-side pagination (page + limit) with infinite-scroll or
  pager; never an unbounded `.list()`.
- **Entity-picker dropdowns:** replace "load all customers/tenants" with
  **async typeahead** (debounced `filter({ search }, sort, 20)`); a select of 10M
  options is not viable.
- Add a lint guard / code-review rule to ban bare `.list()` on high-cardinality
  entities (Customer, PickupRequest, Payment, Invoice, ServicePoint, SensorReading).

### 4.2 Production observability
There is a custom `logger` and an `ErrorBoundary`, but **no third-party APM /
error tracking** (no Sentry/Datadog/OpenTelemetry). At scale you need:
- Front-end error + performance monitoring (e.g. Sentry) with release tracking.
- Real-user metrics (Core Web Vitals, route-level latency).
- Backend/Base44 function error rates, queue depth, and slow-query dashboards
  (the `IntegrationQueue` / `ExceptionQueue` patterns suggest async work that
  needs depth/lag alerting).

### 4.3 Load & soak testing
No evidence of load testing. Before 10M users, establish:
- Throughput/latency targets and a load test against the Base44 backend and the
  heaviest functions (`aiRouteOptimiser`, `fillLevelRouteOptimiser`, invoicing,
  payment reminders).
- Soak tests for the scheduled automations and queue drains.
- A capacity conversation with Base44 on per-tenant/per-table limits, rate limits,
  connection ceilings, and DB indexing for the `filter()` fields used in hot paths.

## 5. P1 — strongly recommended before broad rollout

- **Test coverage for critical flows.** `src/__tests__/e2e/` is a README stub.
  Add e2e/integration coverage for dispatch, payments, and the customer
  self-service flows (already on the roadmap).
- **Lazy-load heavy libs.** `jspdf` (390 KB) + `html2canvas` (194 KB) and the
  `recharts` bundle (357 KB) should load only on the screens/actions that use
  them (dynamic `import()` behind the export/report buttons), trimming first paint.
- **Rate limiting / abuse protection** on public endpoints (`/pay/:token`,
  customer app, support chat) and on AI-backed functions (cost control).
- **Caching/CDN strategy** for static assets and cacheable reads; confirm
  React Query `staleTime`/`gcTime` per entity (currently a single 60 s default).

## 6. P2 — scale maturity

- **Multi-region / i18n / multi-currency.** UGX and Kampala lat/lng fallbacks are
  hard-coded in optimisers; generalise for multi-country scale.
- **Data lifecycle.** Archival/retention for high-growth tables (SensorReading,
  VehicleTelematics, AuditLog, PickupRequest) to keep hot tables small.
- **Feature flags & staged rollout** for safe progressive delivery.
- **Backups / DR runbook** and a documented incident process.

## 7. Remediation roadmap

1. **Sprint 1 (P0a):** pagination + typeahead sweep across the 77 `.list()` sites;
   add the lint guard. Ship behind verification against a seeded large-tenant.
2. **Sprint 1–2 (P0b):** integrate error/perf monitoring; stand up queue-lag and
   function-error dashboards.
3. **Sprint 2 (P0c):** load/soak test; capacity review with Base44; add indexes
   for hot `filter()` fields.
4. **Sprint 3 (P1):** e2e coverage for money/dispatch/customer flows; lazy-load
   pdf/canvas/charts; rate limiting.
5. **Sprint 4+ (P2):** multi-region/i18n, data archival, feature flags, DR.

## 8. Notes & caveats

- The Base44 backend is **not reachable from this environment**
  (`VITE_BASE44_APP_BASE_URL` unset), so all findings are from **static analysis +
  build**. Backend throughput, DB indexing, and platform limits must be validated
  with Base44 directly and under load before committing to a 10M-user target.
