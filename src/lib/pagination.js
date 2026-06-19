// Pagination & bounded-fetch helpers — part of the scale remediation.
// The Base44 SDK supports `entity.list(sort, limit)` and
// `entity.filter(query, sort, limit)`; these helpers keep limits sane and
// consistent so no screen ever fetches an unbounded table.

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 500;

// Largest single bounded scan for analytics screens that compute client-side
// metrics over recent activity. Matches the Base44 per-request projection cap.
// Pages using this should disclose "based on the most recent N records" when the
// cap is reached, so totals are never silently truncated.
export const ANALYTICS_SCAN_LIMIT = 5000;

// Entities that grow with usage and must never be fetched unbounded on the client.
export const HIGH_CARDINALITY_ENTITIES = [
  'Customer',
  'PickupRequest',
  'Payment',
  'Invoice',
  'ServicePoint',
  'SensorReading',
  'VehicleTelematics',
  'AuditLog',
];

// Clamp a requested limit into [1, MAX_PAGE_SIZE], falling back to the default.
export function clampLimit(limit, fallback = DEFAULT_PAGE_SIZE) {
  const n = Number(limit);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), MAX_PAGE_SIZE);
}

// Whether more rows likely exist: a full page came back, so there may be another.
export function hasNextPage(received, limit) {
  const cap = clampLimit(limit);
  return Array.isArray(received) && received.length >= cap;
}

// Slice an in-memory array for a given 1-based page (used for client-side paging
// of already-bounded result sets).
export function getPageSlice(items = [], page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  const size = clampLimit(pageSize);
  const p = Math.max(1, Math.floor(Number(page) || 1));
  const start = (p - 1) * size;
  return items.slice(start, start + size);
}

export function pageCount(total = 0, pageSize = DEFAULT_PAGE_SIZE) {
  const size = clampLimit(pageSize);
  return Math.max(1, Math.ceil((Number(total) || 0) / size));
}

// De-duplicate entity rows by id, preserving first-seen order. Useful when
// merging a "recent" page with server search hits in pickers.
export function dedupeById(rows = []) {
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    if (!r || r.id == null || seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}
