// Fill-level classification and overflow forecasting for smart-bin containers.
// Pure helpers shared by the SmartBins dashboard and the collection optimiser.

export const FILL_THRESHOLDS = {
  // Fill % at or above which a container is considered to need collection.
  full: 80,
  // Fill % at or above which a container is "filling" (early warning).
  warning: 60,
  // Fill % at or above which a container is treated as overflowing.
  overflow: 95,
};

// Classify a raw fill percentage into an operational status.
// Returns 'unknown' when the value is missing or not a finite number.
export function classifyFill(fillPct) {
  if (typeof fillPct !== 'number' || !Number.isFinite(fillPct)) return 'unknown';
  if (fillPct >= FILL_THRESHOLDS.overflow) return 'overflow';
  if (fillPct >= FILL_THRESHOLDS.full) return 'full';
  if (fillPct >= FILL_THRESHOLDS.warning) return 'filling';
  return 'ok';
}

// Estimate days until a container reaches 100% given its average daily fill rate.
// Returns 0 when already full, and null when the rate is unknown / non-positive.
export function predictDaysToFull(currentPct, dailyFillRatePct) {
  if (typeof currentPct !== 'number' || !Number.isFinite(currentPct)) return null;
  if (typeof dailyFillRatePct !== 'number' || !Number.isFinite(dailyFillRatePct) || dailyFillRatePct <= 0) {
    return null;
  }
  const remaining = 100 - currentPct;
  if (remaining <= 0) return 0;
  return Math.round((remaining / dailyFillRatePct) * 10) / 10;
}

// Decide whether a container should be collected, either because it is already
// at/over its threshold, or because it is forecast to overflow within
// `horizonDays` (so it can be swept up on the next run before it overflows).
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

// Summarise a fleet of containers into dashboard KPIs.
export function summariseContainers(containers = []) {
  const summary = { total: containers.length, overflow: 0, full: 0, filling: 0, ok: 0, unknown: 0, needsCollection: 0 };
  for (const c of containers) {
    summary[classifyFill(c.last_fill_pct)] += 1;
    if (needsCollection(c)) summary.needsCollection += 1;
  }
  return summary;
}
