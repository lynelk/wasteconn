# Server-Side Aggregation — Backend Function Specs

_Audience: backend team · Status: proposed · Source: `LAUNCH_READINESS.md` P0.1 / "server-side aggregation"_

## Why this exists

Several analytics/overview screens still call `entity.list()` to pull **whole
tables** into the browser purely to compute counts and sums (e.g. Dashboard KPIs,
Billing/Payments summaries, per-zone coverage). At 10M customers this is
infeasible. The frontend has already eliminated whole-table loads everywhere a
**bounded list + lookup** works (`useEntitySearch`, `useEntitiesByIds`,
`EntitySelect`); what remains are genuine **aggregations** that must run on the
server.

**Constraint:** the Base44 SDK entity API exposes `list` / `filter` / `create` /
`update` / `delete` / bulk ops, but **no `count()` or `aggregate()`**. So these
aggregates need dedicated backend functions (Deno, like the existing
`base44/functions/*`).

## Recommended architecture

Two complementary mechanisms:

1. **Maintained counters (preferred for hot, low-cardinality rollups).**
   Keep a small `MetricSnapshot` entity of pre-computed values per tenant,
   updated incrementally by the entity lifecycle hooks that already exist
   (`onPickupCompleted`, `onRouteCompleted`, `paymentWebhookHandler`,
   `auditEventHandler`, …) and/or a scheduled reconciler. Reads become O(1).
2. **On-demand aggregation functions (for parameterised/date-ranged queries).**
   A Deno function that computes the aggregate server-side. Until a native
   aggregation pipeline is available, implement by scanning with
   **projection + pagination** (`filter(where, sort, 5000, skip, [fields])`,
   looping `skip` until exhausted) so only the needed columns cross the wire.
   Cache results (per tenant + params) for 30–60 s.

> If the platform can expose a raw Mongo aggregation pipeline inside functions,
> prefer that over the scan loop — note it back to the frontend team and we'll
> simplify accordingly.

## Cross-cutting requirements

- **Tenant scoping (required).** Every function derives `tenant_id` from the
  caller (`base44.auth.me()`) and filters by it via `asServiceRole`. Never accept
  `tenant_id` from the client except for `super_admin`.
- **AuthN/Z.** Reject unauthenticated calls (401). Respect existing RBAC scopes
  (`analytics:read`, `reports:read`, etc.).
- **Response envelope.** `{ success, data, generated_at, cached }`.
- **Indexing.** Ensure indexes on every field used in `where`/`groupBy`:
  `tenant_id`, `status`, `zone_id`, `customer_id`, `scheduled_date`,
  `created_date`, `payment_method`, `current_stock`.
- **Performance target.** p95 < 300 ms for counter-backed reads; < 1.5 s for
  on-demand scans over a tenant's working set.

---

## Endpoints

### 1. `dashboardMetrics`
- **Consumer:** `src/pages/Dashboard.jsx` (replaces `Customer.list`,
  `PickupRequest.list`, `Payment.list`, `Complaint.list`, `Vehicle.list`,
  `Inventory.list`, `ServicePoint.list`).
- **Request:** `{}` (tenant from auth; `super_admin` may pass `{ tenant_id }`).
- **Response `data`:**
  ```json
  {
    "customers_total": 0,
    "service_points_total": 0,
    "pickups_pending": 0,
    "complaints_open": 0,
    "revenue_completed_ugx": 0,
    "vehicles_available": 0,
    "inventory_low_stock": 0
  }
  ```
- **Notes:** `inventory_low_stock` = count where `current_stock <= safety_threshold`
  (field-to-field comparison — compute in the function or store a boolean
  `is_low_stock` flag maintained by `checkInventoryAlerts`).

### 2. `billingSummary`
- **Consumer:** `src/pages/BillingPage.jsx` (replaces `Invoice.list`).
- **Request:** `{ month?: "YYYY-MM" }`.
- **Response `data`:**
  ```json
  {
    "total_issued": 0, "total_paid": 0, "total_overdue": 0,
    "revenue_ugx": 0, "outstanding_ugx": 0
  }
  ```
  `revenue_ugx` = Σ`amount_ugx` where `status=paid`; `outstanding_ugx` =
  Σ`amount_ugx` where `status ∈ {issued, overdue, partially_paid}`.

### 3. `paymentsSummary`
- **Consumer:** `src/pages/Payments.jsx` (replaces `Payment.list` aggregates).
- **Request:** `{ from?, to? }` (ISO dates).
- **Response `data`:**
  ```json
  {
    "total_completed_ugx": 0,
    "flagged_count": 0,
    "by_method": { "mtn_momo": 0, "airtel_money": 0, "cash": 0, "bank_transfer": 0, "yo_payments": 0 }
  }
  ```
  (The paginated payments **table** stays a bounded `list('-created_date', N)`;
  this endpoint only supplies the header totals.)

### 4. `zoneCustomerCounts`
- **Consumer:** `src/pages/ServiceZones.jsx` (replaces `Customer.list` used only
  to count customers per zone).
- **Request:** `{}`.
- **Response `data`:** `[{ "zone_id": "...", "customer_count": 0 }]`
  (group `Customer` by `zone_id`).

### 5. `zoneCoverageStats`
- **Consumer:** `src/pages/CoverageAnalytics.jsx`.
- **Request:** `{ from: "YYYY-MM-DD", to: "YYYY-MM-DD", zone_id? }`.
- **Response `data`:**
  ```json
  [{
    "zone_id": "...",
    "scheduled": 0, "completed": 0, "missed": 0,
    "repeat_miss_exceptions": 0,
    "coverage_pct": 0
  }]
  ```
  Group `PickupRequest` by `zone_id` within the date range; `repeat_miss` joins
  `ExceptionQueue` (`exception_type=missed_pickup`). `coverage_pct =
  completed / scheduled * 100`.

### 6. `customerSegmentCount` + `sendSmsCampaign`
- **Consumer:** `src/pages/MarketingHub.jsx` (replaces `Customer.list` /
  `Subscription.list`).
- **`customerSegmentCount`** — preview the audience size without downloading it.
  - **Request:** `{ segment: { zone_id?, customer_type?, customer_segment?, has_active_subscription?, ... } }`
  - **Response `data`:** `{ count: 0 }`
- **`sendSmsCampaign`** — segmentation + send must run server-side (sending to a
  10M audience cannot live in the browser).
  - **Request:** `{ segment, message, dry_run? }`
  - **Response `data`:** `{ recipients: 0, queued: 0, sms_credits_estimated: 0, campaign_id }`
  - Enqueue via the existing comms/queue infra; return immediately and process
    asynchronously.

### 7. `entityAggregate` (optional generic fallback)
Covers the long tail without a function per screen.
- **Request:**
  ```json
  {
    "entity": "PickupRequest",
    "where": { "status": "pending" },
    "group_by": "zone_id",
    "metrics": [{ "op": "count" }, { "op": "sum", "field": "amount_ugx" }]
  }
  ```
- **Response `data`:** `[{ "group": "<value>", "count": 0, "sum_amount_ugx": 0 }]`
- **Guardrails:** allow-list of `{entity, field}` pairs; mandatory tenant scope;
  hard cap on group cardinality; reject ungrouped scans without `where`.

---

## Frontend integration (after delivery)

Each endpoint will be consumed through a `useQuery` calling
`base44.functions.invoke('<name>', params)`, replacing the corresponding
`entity.list()` aggregate. The ESLint guard (`no-restricted-syntax` on bare
`.list()` for high-cardinality entities) stays in place to prevent regressions.

## Acceptance criteria

- [ ] Each endpoint returns correct totals vs. a seeded fixture tenant.
- [ ] No endpoint loads an unbounded result into memory (projection + paginated
      scan, or counter-backed).
- [ ] All reads are tenant-scoped and RBAC-checked; cross-tenant access blocked.
- [ ] p95 latency within targets on a tenant with ≥ 1M customers.
- [ ] Indexes created for all `where`/`group_by` fields.

## Phased rollout

1. `dashboardMetrics`, `billingSummary`, `paymentsSummary` (highest-traffic).
2. `zoneCustomerCounts`, `zoneCoverageStats`.
3. `customerSegmentCount` + `sendSmsCampaign`.
4. `entityAggregate` generic fallback + retire remaining aggregate `.list()`s.

## Implementation status

Reference implementations scaffolded in `base44/functions/` (interim
projection + paginated-scan approach; swap to maintained counters per the
architecture section before high scale):

- [x] `dashboardMetrics`
- [x] `billingSummary`
- [x] `paymentsSummary`
- [x] `zoneCustomerCounts`
- [x] `zoneCoverageStats`
- [x] `customerSegmentCount`
- [ ] `sendSmsCampaign` — bulk send job; wire to the existing comms/queue infra
- [ ] `entityAggregate` — generic fallback (phase 4)

**Validation needed before frontend cutover:** these functions have not been run
against a live tenant from this environment. Backend team to (1) verify each
against a seeded fixture tenant, (2) add the indexes listed above, then (3)
confirm — at which point the frontend swaps each aggregate `entity.list()` for a
`base44.functions.invoke('<name>', params)` call (one screen per PR, kept atomic
since functions deploy with the app). Cutover is intentionally **not** bundled
with this scaffold so unverified aggregates never reach a live dashboard.

### Frontend cutover checklist (next PRs)
- [ ] Dashboard → `dashboardMetrics`
- [ ] BillingPage → `billingSummary`
- [ ] Payments → `paymentsSummary`
- [ ] ServiceZones → `zoneCustomerCounts`
- [ ] CoverageAnalytics → `zoneCoverageStats`
- [ ] MarketingHub → `customerSegmentCount` (+ `sendSmsCampaign` when ready)
