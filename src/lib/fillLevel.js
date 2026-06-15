// fillLevel.js — legacy shim. All logic has moved to lib/capacityAnalytics.js.
// This file re-exports everything so existing imports continue to work unchanged.
export {
  FILL_THRESHOLDS,
  classifyFill,
  predictDaysToFull,
  needsCollection,
  summariseContainers,
} from './capacityAnalytics.js';