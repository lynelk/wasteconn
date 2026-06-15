import http from 'k6/http';
import { check } from 'k6';

// Load test for the server-side aggregation functions (the screens that used to
// scan whole tables). Validates they hold up under concurrency on a seeded
// large tenant — the gate before frontend cutover (see AGGREGATION_SPECS.md).
//
// Run:
//   BASE_URL=https://your-app \
//   APP_ID=... TOKEN=... \
//   k6 run load-tests/k6/aggregation-load.js

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4173';
const TOKEN = __ENV.TOKEN || '';
const APP_ID = __ENV.APP_ID || '';

export const options = {
  scenarios: {
    ramp: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: Number(__ENV.VUS || 25) },
        { duration: '2m', target: Number(__ENV.VUS || 25) },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    // Target from LAUNCH_READINESS: on-demand aggregation p95 < 1.5s.
    http_req_duration: ['p(95)<1500'],
  },
};

const FUNCTIONS = [
  ['dashboardMetrics', {}],
  ['billingSummary', {}],
  ['paymentsSummary', {}],
  ['zoneCustomerCounts', {}],
];

function invoke(name, payload) {
  return http.post(`${BASE_URL}/api/apps/${APP_ID}/functions/${name}`, JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
  });
}

export default function () {
  for (const [name, payload] of FUNCTIONS) {
    const res = invoke(name, payload);
    check(res, {
      [`${name} 200`]: (r) => r.status === 200,
      [`${name} ok`]: (r) => {
        try { return r.json('success') === true; } catch { return false; }
      },
    });
  }
}
