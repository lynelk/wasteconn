# WasteConn — Launch Checklist & Runbook

Operational go-live steps. Code readiness is covered by `LAUNCH_READINESS.md`;
this file is the turnkey checklist for the items that require the **deploy
environment + a seeded backend** (i.e. cannot be completed from the repo alone).

---

## 1. Environment & secrets

Copy `.env.example` → `.env.local` (frontend) and provision the backend function
secrets in the Base44 environment. Nothing here lives in the repo.

### Frontend (Vite — must be set at build time)
- [ ] `VITE_BASE44_APP_ID`
- [ ] `VITE_BASE44_APP_BASE_URL`
- [ ] `VITE_BASE44_FUNCTIONS_VERSION` (or leave blank for published default)
- [ ] `VITE_UPTRACE_DSN` — **set this so monitoring/RUM is live from day one** (no-op if unset)
- [ ] `VITE_APP_RELEASE` — git sha or tag, for error/telemetry correlation

### Base44 function secrets (backend env — never in the client bundle)
- [ ] `SENSOR_WEBHOOK_KEY` — smart-bin ingestion webhook bearer token
- [ ] `PAYMENT_WEBHOOK_SECRET` — verifies inbound payment webhooks
- [ ] `DEFAULT_TENANT_ID` — fallback tenant for unauthenticated public reports
- [ ] `APP_BASE_URL` — used by server functions for links/callbacks
- [ ] `CITOCONNECT_API_URL`, `CITOCONNECT_API_KEY` — SMS / messaging
- [ ] `YO_API_URL`, `YO_USERNAME`, `YO_PASSWORD` — Yo! mobile-money
- [ ] `WIALON_API_URL`, `WIALON_API_TOKEN` — fleet telematics
- [ ] `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`, `QBO_REALM_ID`, `QBO_REFRESH_TOKEN` — QuickBooks

## 2. Observability
- [ ] `VITE_UPTRACE_DSN` set; confirm errors + Web Vitals arrive in Uptrace (`src/lib/monitoring.js`).
- [ ] Confirm `ClientErrorLog` is capturing boundary/window errors (`errorReporter`).
- [ ] Dashboards/alerts for Base44 function error rates and `IntegrationQueue` / `ExceptionQueue` depth.

## 3. Pre-launch verification (against a seeded tenant)
- [ ] Sign in as `super_admin` and open **Pre-Launch Dashboard** (`/pre-launch`); confirm all runtime probes pass.
- [ ] Seed a representative tenant (`seedFoundationData` function) for QA + load.
- [ ] Smoke the critical flows: customer signup → pickup request → dispatch → completion → payment → invoice; deposit-return scan; loyalty redeem; public report.

## 4. Automated tests
- [ ] `npm run lint` · `npm run typecheck` · `npm run build` · `npm run test` (unit) — all green.
- [ ] **e2e (Playwright):** `npx playwright test` from `e2e/` against a deployed, seeded environment (needs a base URL + test creds).
- [ ] **Load (k6):** run against the seeded large tenant and confirm latency/error thresholds:
  - `k6 run load-tests/k6/smoke.js`
  - `k6 run load-tests/k6/aggregation-load.js`
  - Validate the aggregation functions (`dashboardMetrics`, `paymentsSummary`, `billingSummary`, `zoneCustomerCounts`, `zoneCoverageStats`, `customerSegmentCount`, `entityAggregate`) and add DB indexes for the `filter()` fields on hot paths.

## 5. Scale hardening (track post-pilot)
- [ ] **Analytics-aggregate dashboard cutover** — see §6 below; gated on the k6/index validation in step 4.
- [ ] Schedule `archiveStaleRecords` with retention sign-off (SensorReading, VehicleTelematics, AuditLog).
- [ ] Production rate-limit tuning (`RateLimit` entity; `sendSmsCampaign` and AI endpoints).
- [ ] Base44 capacity / data-residency confirmation.

## 6. Analytics-aggregate dashboard cutover (ready to execute, backend-gated)

The label/picker unbounded-`.list()` sweep is **done**. The remaining unbounded
reads are the analytics dashboards, which compute over whole tables. They need
the server-aggregation functions wired in — but the **charts/maps need row-level
series the functions don't return**, so each screen needs a deliberate split:

| Screen | Exact-total tiles → server fn | Chart / map / feed data |
|---|---|---|
| `Dashboard` | `dashboardMetrics` | bound to a recent window (active pickups, recent N) |
| `Analytics` | `paymentsSummary` | recent-window payment/pickup series |
| `BillingPage` (arrears) | `billingSummary` | bounded invoice window |
| `CoverageAnalytics` / `ServiceZones` | `zoneCustomerCounts`, `zoneCoverageStats` | n/a |
| `MarketingHub` / `Communications` | `customerSegmentCount` | n/a |
| `ReportingDashboard` | `paymentsSummary` / `entityAggregate` | bounded window |

**Why not done in-repo yet:** wiring the tiles is correct-by-contract, but
(a) it can't be verified without a seeded backend (function shapes/perf/indexes),
and (b) bounding chart/map data to a recent window is a product decision. Do this
**one screen per PR**, each validated against the seeded tenant from step 3–4.
