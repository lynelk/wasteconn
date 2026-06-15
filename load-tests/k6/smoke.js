import http from 'k6/http';
import { check, sleep } from 'k6';

// Smoke load test: low traffic against the deployed app shell + static assets.
// Run: BASE_URL=https://your-app k6 run load-tests/k6/smoke.js

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4173';

export const options = {
  vus: Number(__ENV.VUS || 5),
  duration: __ENV.DURATION || '1m',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800'],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/`);
  check(res, {
    'status is 200': (r) => r.status === 200,
    'serves html': (r) => String(r.headers['Content-Type'] || '').includes('text/html'),
  });
  sleep(1);
}
