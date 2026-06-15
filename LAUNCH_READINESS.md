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

## Remediation progress — Phase 1 (shipped)

Safe, in-repo, fully-validated first slice of the roadmap below:

- **P0.1 foundations:** `src/lib/pagination.js` (bounded-fetch helpers + caps),
  `src/hooks/useEntitySearch.js` + `src/components/common/EntitySelect.jsx`
  (scalable async typeahead picker), and an **ESLint guard** that flags any new
  unbounded `.list()` on a high-cardinality entity. Migrated the worst customer
  pickers (`ComplaintForm`, `PickupForm`, `PaymentForm`) off `Customer.list()`.
- **P1 bundle:** lazy-loaded `jspdf` at its two remaining static-import sites
  (`CustomerInvoiceCard`, `CitoReportExport`); it is now a separate on-demand
  chunk instead of eager weight in the customer bundle.
- **P2 foundation:** `src/lib/region.js` centralises currency/locale/map-centre
  (previously hard-coded UGX / Kampala literals).

## Remediation progress — Phase 2 (shipped)

Confirmed the Base44 SDK supports MongoDB-style operators (`$regex`, `$or`),
`list(sort, limit, skip)` pagination, and field projection (max 5,000/request) —
so server-side search/pagination is now usable directly.

- **P0.1 server-side search:** `useEntitySearch` now pushes search to the server
  via `filter({ $or: [{ field: { $regex } }] }, sort, limit)` (case-insensitive,
  input-escaped) instead of client-filtering — making every `EntitySelect` picker
  both correct and scalable. Migrated the `YoPaymentPanel` customer picker too.
- **P0.2 observability (Uptrace APM):** `src/lib/monitoring.js` — fail-safe,
  env-gated (`VITE_UPTRACE_DSN`) OTLP/HTTP exporter to Uptrace with no heavy OTel
  browser SDK, plus Web Vitals (CLS/LCP/INP/FCP/TTFB) RUM. Wired into
  `errorReporter` (errors → OTLP logs) and `main.jsx`; no-op without a DSN.

**To finish observability:** set `VITE_UPTRACE_DSN` (and optional
`VITE_APP_RELEASE`) in the deploy environment to start shipping telemetry.

## Remediation progress — Phase 3 (shipped)

- **P0.1 referenced-row resolution:** new `useEntitiesByIds` hook resolves only
  the rows a bounded list references via `filter({ id: { $in } })` (chunked),
  replacing "load the whole table to label a list". Applied to the `Complaints`
  and `Subscriptions` pages (dropping `Customer.list()` / `ServicePoint.list()`),
  and bounded the previously-unbounded `Complaint.list('-created_date')`.
- **P0.1 contract picker:** `ContractForm` now uses `EntitySelect` for the
  customer and fetches the chosen customer's service points on demand
  (`ServicePoint.filter({ customer_id })`) instead of receiving whole tables.
- **P1 lint debt cleared (item C):** `lint:fix` removed all 119 unused-import
  errors; full `npm run lint` is now clean.

Remaining bare `.list()` on high-cardinality entities (≈23, flagged by the
ESLint guard) are **aggregate/analytics** screens (`MarketingHub` segment
counts, `ServiceZones` per-zone customer counts, etc.) that need a server-side
count/aggregation endpoint rather than a client cap — tracked under
"server-side aggregation" below.

## Remediation progress — Phase 4 (shipped)

Additive infra + ops scaffolding (none change existing screens; the live
dashboard cutover is held until the backend validates the functions):

- **E2E lane** — Playwright (`e2e/`, `.github/workflows/e2e.yml`).
- **Aggregation functions** — `dashboardMetrics`, `billingSummary`,
  `paymentsSummary`, `zoneCustomerCounts`, `zoneCoverageStats`,
  `customerSegmentCount`, plus `sendSmsCampaign` (bulk, rate-limited) and the
  generic `entityAggregate` (see `docs/AGGREGATION_SPECS.md`).
- **Rate limiting** — `RateLimit` entity + fail-open fixed-window limiter,
  applied to `sendSmsCampaign` (cost control); reusable pattern for other
  public/AI endpoints.
- **Data archival** — `archiveStaleRecords` scheduled function + `ArchivedRecord`
  entity (dry-run by default) to keep high-growth tables small.
- **Load testing** — k6 scripts (`load-tests/`) with the latency/error
  thresholds from this doc + a manual-dispatch CI workflow.
- **Multi-region** — `region.js` tenant resolvers (`resolveRegion`,
  `formatCurrencyForTenant`) + rollout plan (`docs/MULTI_REGION.md`).
- **DR** — `docs/DR_RUNBOOK.md` (RTO/RPO, scenarios, backup/restore, drills).

### Still requires a live backend / product decision
- **Frontend cutover** of the aggregation functions (one screen per PR) — gated
  on backend validating each against a seeded large tenant (run
  `load-tests/k6/aggregation-load.js`) and adding indexes.
- **Backend-backed e2e** happy-path suite against a seeded tenant.
- Base44 capacity review; data-residency confirmation; production rate-limit
  tuning; scheduling `archiveStaleRecords` with real retention sign-off.

Remaining `.list()` migrations, observability vendor wiring, load testing, and
infra items are tracked below. _Note: an `errorReporter` already exists
(captures window/rejection/boundary errors, batched to `ClientErrorLog`); what's
missing is a third-party APM + RUM/Web-Vitals layer._

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
There is a custom `logger`, an `ErrorBoundary`, and an `errorReporter` that
persists client errors to `ClientErrorLog` — but **no third-party APM / RUM**
(no Sentry/Datadog/OpenTelemetry, no Web-Vitals). At scale you need:
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
  self-service flows (already on the roadmap). _Unit coverage has grown to 96
  tests; e2e needs a browser+backend CI lane (Playwright) that isn't available
  in this environment._
- **Lazy-load heavy libs.** ✅ `jspdf` is now lazy-loaded everywhere. `recharts`
  (357 KB) and `html2canvas` (194 KB) remain candidates to defer behind the
  report/chart screens.
- **Rate limiting / abuse protection** on public endpoints (`/pay/:token`,
  customer app, support chat) and on AI-backed functions (cost control).
  _Backend (Base44 function) concern — not addressable from the client._
- **Caching/CDN strategy** for static assets and cacheable reads; confirm
  React Query `staleTime`/`gcTime` per entity (currently a single 60 s default).
- **Lint debt — ✅ DONE.** All unused-import errors removed; `npm run lint` is
  clean. An ESLint guard now blocks new unbounded `.list()` on hot entities.

### Server-side aggregation (remaining `.list()` sweep)
A handful of analytics screens still read whole tables to compute counts
(`MarketingHub`, `ServiceZones`, etc.). These need a backend count/aggregation
endpoint (the SDK has no `count()`), not a client-side cap. Tracked for the
backend team.

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
