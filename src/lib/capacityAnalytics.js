// Unified capacity analytics for smart bins (volume) and skips (weight).
// All functions operate on the shared `last_fill_pct` normalised field so that
// dashboards and route optimisers need no knowledge of the underlying sensor type.

export const FILL_THRESHOLDS = {
  overflow: 95,
  full: 80,
  warning: 60,
};

// ---------------------------------------------------------------------------
// Normalisation helpers
// ---------------------------------------------------------------------------

/**
 * Compute a normalised fill percentage (0-100) from a raw weight reading.
 * Returns null when inputs are invalid.
 */
export function weightToFillPct(weightKg, maxWeightKg) {
  if (
    typeof weightKg !== 'number' || !Number.isFinite(weightKg) ||
    typeof maxWeightKg !== 'number' || !Number.isFinite(maxWeightKg) || maxWeightKg <= 0
  ) return null;
  return Math.max(0, Math.min(100, (weightKg / maxWeightKg) * 100));
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/** Classify a normalised fill % into an operational status. */
export function classifyFill(fillPct) {
  if (typeof fillPct !== 'number' || !Number.isFinite(fillPct)) return 'unknown';
  if (fillPct >= FILL_THRESHOLDS.overflow) return 'overflow';
  if (fillPct >= FILL_THRESHOLDS.full) return 'full';
  if (fillPct >= FILL_THRESHOLDS.warning) return 'filling';
  return 'ok';
}

// ---------------------------------------------------------------------------
// Forecasting
// ---------------------------------------------------------------------------

/**
 * Estimate days until the container reaches 100% fill.
 * Returns 0 if already full, null if rate is unknown/non-positive.
 */
export function predictDaysToFull(currentPct, dailyFillRatePct) {
  if (typeof currentPct !== 'number' || !Number.isFinite(currentPct)) return null;
  if (typeof dailyFillRatePct !== 'number' || !Number.isFinite(dailyFillRatePct) || dailyFillRatePct <= 0) return null;
  const remaining = 100 - currentPct;
  if (remaining <= 0) return 0;
  return Math.round((remaining / dailyFillRatePct) * 10) / 10;
}

/**
 * Estimate days until a skip reaches its max weight capacity.
 * Returns 0 if already at or over capacity, null when inputs are invalid.
 */
export function predictDaysToMaxWeight(currentWeightKg, maxWeightKg, dailyWeightGainKg) {
  if (
    typeof currentWeightKg !== 'number' || !Number.isFinite(currentWeightKg) ||
    typeof maxWeightKg !== 'number' || !Number.isFinite(maxWeightKg) || maxWeightKg <= 0 ||
    typeof dailyWeightGainKg !== 'number' || !Number.isFinite(dailyWeightGainKg) || dailyWeightGainKg <= 0
  ) return null;
  const remaining = maxWeightKg - currentWeightKg;
  if (remaining <= 0) return 0;
  return Math.round((remaining / dailyWeightGainKg) * 10) / 10;
}

// ---------------------------------------------------------------------------
// Collection trigger
// ---------------------------------------------------------------------------

/** Decide whether a container should be collected now or within `horizonDays`. */
export function needsCollection(container = {}, horizonDays = 1) {
  const fill = container.last_fill_pct;
  const threshold =
    typeof container.collection_threshold_pct === 'number'
      ? container.collection_threshold_pct
      : FILL_THRESHOLDS.full;

  if (typeof fill === 'number' && Number.isFinite(fill) && fill >= threshold) return true;

  const daysToFull = predictDaysToFull(fill, container.avg_daily_fill_rate_pct);
  return daysToFull !== null && daysToFull <= horizonDays;
}

// ---------------------------------------------------------------------------
// Fleet summary (dashboard KPIs)
// ---------------------------------------------------------------------------

/** Summarise a fleet of containers into dashboard KPI counts. */
export function summariseContainers(containers = []) {
  const summary = { total: containers.length, overflow: 0, full: 0, filling: 0, ok: 0, unknown: 0, needsCollection: 0, bins: 0, skips: 0 };
  for (const c of containers) {
    summary[classifyFill(c.last_fill_pct)] += 1;
    if (needsCollection(c)) summary.needsCollection += 1;
    if (c.asset_category === 'skip') summary.skips += 1;
    else summary.bins += 1;
  }
  return summary;
}

// ---------------------------------------------------------------------------
// Back-compat re-exports (so any existing import of fillLevel.js still works)
// ---------------------------------------------------------------------------
export { classifyFill as default };