# Disaster Recovery Runbook — WasteConn

_Status: initial · Owner: platform on-call · Review quarterly_

WasteConn runs on Base44 (managed backend, DB, auth, functions) with a
React/Vite frontend. This runbook covers detection, response, and recovery for
the failure modes that matter at scale. Fill the bracketed `[…]` values with
your environment specifics.

## Objectives

| Metric | Target |
|---|---|
| RTO (restore service) | **[4 hours]** |
| RPO (max data loss) | **[1 hour]** |
| Status page | **[link]** |

## Roles

- **Incident commander** — coordinates, declares severity, owns comms.
- **Ops/backend** — Base44 console, DB, functions, integrations.
- **Comms** — customer/stakeholder updates via status page.

## Severity

| Sev | Definition | Response |
|---|---|---|
| SEV1 | Full outage / data loss | Page on-call immediately; all hands |
| SEV2 | Major feature down (payments, dispatch) | Page owning team within 15 min |
| SEV3 | Degraded / single-tenant | Next business hours |

## Detection

- **Uptrace APM** (`VITE_UPTRACE_DSN`) — error-rate and Web-Vitals spikes.
- **`ClientErrorLog`** entity — client-side error surge.
- Integration health: `IntegrationHealth`, `ExceptionQueue`, `IntegrationQueue`,
  `slaBreachMonitor`, `aiTenantHealthMonitor`.
- Synthetic check: the k6 smoke test (`load-tests/`) or an external uptime probe.

## Common scenarios

### 1. Frontend broken deploy
1. Confirm via Uptrace error spike / smoke test failure.
2. **Roll back** to the previous build/release in the host (Base44 / CDN).
3. Verify with the smoke test; post status update.
4. Postmortem: the e2e + build CI gates should have caught it — add coverage.

### 2. Backend / Base44 platform incident
1. Check the Base44 status page and console.
2. If platform-wide: escalate to Base44 support; communicate ETA; the app shows
   cached data where React Query `gcTime` allows, and the driver/field apps keep
   working **offline** (IndexedDB queue) — collections continue, syncing on
   recovery.
3. On recovery: confirm offline queues drained (`useSyncManager`,
   `integrationQueueWorker`), reconcile payments (`reconcilePayments`).

### 3. Data corruption / bad migration
1. Stop the offending writer (disable the function/automation).
2. Restore affected entities from **[Base44 backups / point-in-time restore]**
   to RPO.
3. Replay events from `AuditLog` / `IntegrationQueue` after the restore point.
4. Reconcile financials (`reconcilePayments`, `fetchSettlements`).

### 4. Payments provider outage (MTN/Airtel/Yo!)
1. `paymentWebhookHandler` / `pollPendingPayments` will lag — expected.
2. Switch affected customers to alternate methods; queue retries
   (`retryFailedSubscriptionPayments`).
3. After recovery, run `reconcilePayments` and verify no double-charges.

### 5. Runaway cost / abuse
1. Identify via Uptrace + function logs.
2. Tighten rate limits (`RateLimit` entity / `sendSmsCampaign` limiter) and,
   if needed, disable the abused public endpoint.

## Backups

- **DB:** rely on Base44 managed backups — **confirm cadence + retention +
  point-in-time-restore window with Base44** and record here: `[…]`.
- **Cold archive:** `archiveStaleRecords` → `ArchivedRecord` retains snapshots of
  aged high-growth rows (recoverable via the stored `payload`).
- **Config/code:** this Git repo (entities, functions, frontend) is the source of
  truth and redeployable.

## Recovery verification checklist

- [ ] Smoke test green against the restored environment.
- [ ] Auth/login works for each role.
- [ ] Payments reconcile with zero discrepancies.
- [ ] Offline queues drained; no stuck `IntegrationQueue` / `ExceptionQueue`.
- [ ] Uptrace error rate back to baseline.
- [ ] Status page updated; postmortem scheduled within 48h.

## Quarterly DR drill

Restore a backup into a scratch environment, run the smoke + aggregation load
tests, and time RTO/RPO against the targets above. Record results and gaps.
