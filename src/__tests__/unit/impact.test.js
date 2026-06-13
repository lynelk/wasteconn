import { describe, it, expect } from 'vitest';
import { computeImpact, DEFAULT_KG_PER_PICKUP, CO2_PER_KG } from '@/lib/impact';

describe('computeImpact', () => {
  it('returns zeros for no pickups', () => {
    expect(computeImpact([])).toEqual({ completedPickups: 0, kgDiverted: 0, co2SavedKg: 0 });
  });

  it('only counts completed pickups', () => {
    const result = computeImpact([
      { status: 'completed', actual_weight_kg: 20 },
      { status: 'pending', actual_weight_kg: 100 },
      { status: 'cancelled' },
    ]);
    expect(result.completedPickups).toBe(1);
    expect(result.kgDiverted).toBe(20);
  });

  it('falls back to default weight when actual weight missing or zero', () => {
    const result = computeImpact([
      { status: 'completed' },
      { status: 'completed', actual_weight_kg: 0 },
    ]);
    expect(result.kgDiverted).toBe(DEFAULT_KG_PER_PICKUP * 2);
  });

  it('computes CO2 savings from kg diverted', () => {
    const result = computeImpact([{ status: 'completed', actual_weight_kg: 100 }]);
    expect(result.co2SavedKg).toBe(100 * CO2_PER_KG);
  });
});
