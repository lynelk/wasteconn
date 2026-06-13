import { describe, it, expect } from 'vitest';
import {
  FILL_THRESHOLDS,
  classifyFill,
  predictDaysToFull,
  needsCollection,
  summariseContainers,
} from '@/lib/fillLevel';

describe('classifyFill', () => {
  it('returns unknown for missing or non-numeric values', () => {
    expect(classifyFill(undefined)).toBe('unknown');
    expect(classifyFill(null)).toBe('unknown');
    expect(classifyFill(NaN)).toBe('unknown');
  });

  it('classifies each band by its threshold', () => {
    expect(classifyFill(10)).toBe('ok');
    expect(classifyFill(FILL_THRESHOLDS.warning)).toBe('filling');
    expect(classifyFill(FILL_THRESHOLDS.full)).toBe('full');
    expect(classifyFill(FILL_THRESHOLDS.overflow)).toBe('overflow');
    expect(classifyFill(120)).toBe('overflow');
  });
});

describe('predictDaysToFull', () => {
  it('returns null when fill or rate is unusable', () => {
    expect(predictDaysToFull(undefined, 10)).toBeNull();
    expect(predictDaysToFull(50, 0)).toBeNull();
    expect(predictDaysToFull(50, -5)).toBeNull();
    expect(predictDaysToFull(50, undefined)).toBeNull();
  });

  it('returns 0 when already full', () => {
    expect(predictDaysToFull(100, 10)).toBe(0);
    expect(predictDaysToFull(105, 10)).toBe(0);
  });

  it('computes remaining capacity divided by daily rate', () => {
    expect(predictDaysToFull(80, 10)).toBe(2);
    expect(predictDaysToFull(50, 20)).toBe(2.5);
  });
});

describe('needsCollection', () => {
  it('is true when fill is at or above the container threshold', () => {
    expect(needsCollection({ last_fill_pct: 85, collection_threshold_pct: 80 })).toBe(true);
    expect(needsCollection({ last_fill_pct: 80, collection_threshold_pct: 80 })).toBe(true);
  });

  it('falls back to the default full threshold when none is set', () => {
    expect(needsCollection({ last_fill_pct: FILL_THRESHOLDS.full })).toBe(true);
    expect(needsCollection({ last_fill_pct: FILL_THRESHOLDS.full - 1 })).toBe(false);
  });

  it('is true when forecast to overflow within the horizon', () => {
    // 70% now, +20%/day → full in 1.5 days; within a 2-day horizon.
    expect(needsCollection({ last_fill_pct: 70, avg_daily_fill_rate_pct: 20 }, 2)).toBe(true);
    // Same bin, 1-day horizon → not yet.
    expect(needsCollection({ last_fill_pct: 70, avg_daily_fill_rate_pct: 20 }, 1)).toBe(false);
  });

  it('is false for a near-empty bin with no forecast signal', () => {
    expect(needsCollection({ last_fill_pct: 10 })).toBe(false);
  });
});

describe('summariseContainers', () => {
  it('tallies status bands and collection demand', () => {
    const summary = summariseContainers([
      { last_fill_pct: 10 },
      { last_fill_pct: 65 },
      { last_fill_pct: 82, collection_threshold_pct: 80 },
      { last_fill_pct: 98 },
      { last_fill_pct: undefined },
    ]);
    expect(summary.total).toBe(5);
    expect(summary.ok).toBe(1);
    expect(summary.filling).toBe(1);
    expect(summary.full).toBe(1);
    expect(summary.overflow).toBe(1);
    expect(summary.unknown).toBe(1);
    // 82% (>= threshold) and 98% (overflow) both need collection.
    expect(summary.needsCollection).toBe(2);
  });
});
