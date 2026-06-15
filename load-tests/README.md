# Load & soak testing

[k6](https://k6.io) scripts for validating WasteConn under load before scaling
toward 10M users (`LAUNCH_READINESS.md` P0.3).

## Install

```bash
brew install k6          # macOS
# or see https://grafana.com/docs/k6/latest/set-up/install-k6/
```

## Scripts

| Script | Purpose |
|---|---|
| `k6/smoke.js` | Low-traffic shell/static-asset check; quick sanity. |
| `k6/aggregation-load.js` | Concurrency test for the server-side aggregation functions on a seeded large tenant — the **gate before frontend cutover**. |

## Run

```bash
# Smoke
BASE_URL=https://staging.example k6 run load-tests/k6/smoke.js

# Aggregation functions (needs a service/test token + app id)
BASE_URL=https://staging.example APP_ID=<appId> TOKEN=<token> \
  VUS=50 k6 run load-tests/k6/aggregation-load.js
```

## Thresholds (from LAUNCH_READINESS)

- Counter-backed reads: p95 < 300 ms
- On-demand aggregation: p95 < 1.5 s
- Error rate < 2%

The scripts encode these as k6 `thresholds`, so a run **fails** if they're missed.

## CI

`.github/workflows/load-test.yml` runs the smoke test on manual dispatch
(`workflow_dispatch`) against a `BASE_URL` you provide. Heavier soak runs should
be scheduled against a dedicated load environment, **never production**, and
require a Base44 capacity review first.

## Soak

For soak testing, raise `DURATION` (e.g. `30m`) at moderate `VUS` and watch
backend queue depth, function error rates, and DB latency in Uptrace.
