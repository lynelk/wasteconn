import { describe, it, expect } from 'vitest';
import { computeImpact, computeEsg, DEFAULT_KG_PER_PICKUP, CO2_PER_KG } from '@/lib/impact';

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

describe('computeEsg', () => {
  it('returns zeroed metrics with no data', () => {
    const esg = computeEsg([], []);
    expect(esg).toMatchObject({ collections: 0, divertedKg: 0, diversionRatePct: 0, co2AvoidedKg: 0 });
  });

  it('counts recyclable and organic collections as diverted, general as not', () => {
    const esg = computeEsg([
      { status: 'completed', waste_type: 'recyclable', actual_weight_kg: 100 },
      { status: 'completed', waste_type: 'organic', actual_weight_kg: 100 },
      { status: 'completed', waste_type: 'general', actual_weight_kg: 100 },
    ], []);
    expect(esg.collectedKg).toBe(300);
    expect(esg.divertedKg).toBe(200);
    expect(esg.diversionRatePct).toBeCloseTo(66.7, 1);
    expect(esg.co2AvoidedKg).toBe(200 * CO2_PER_KG);
  });

  it('treats completed waste-bank intake as recovered and diverted', () => {
    const esg = computeEsg(
      [{ status: 'completed', waste_type: 'general', actual_weight_kg: 100 }],
      [
        { payment_status: 'completed', weight_kg: 50 },
        { payment_status: 'pending', weight_kg: 999 },
      ],
    );
    expect(esg.recoveredKg).toBe(50);
    expect(esg.totalHandledKg).toBe(150);
    expect(esg.divertedKg).toBe(50);
  });

  it('breaks down collected weight by waste stream', () => {
    const esg = computeEsg([
      { status: 'completed', waste_type: 'recyclable', actual_weight_kg: 30 },
      { status: 'completed', waste_type: 'recyclable', actual_weight_kg: 20 },
    ], []);
    expect(esg.byStream.recyclable).toBe(50);
  });

  it('excludes rejected waste-bank loads from recovered/diverted totals', () => {
    const esg = computeEsg([], [
      { payment_status: 'completed', grade: 'A', weight_kg: 40, waste_category: 'plastic' },
      { payment_status: 'completed', grade: 'rejected', weight_kg: 1000, waste_category: 'plastic' },
    ]);
    expect(esg.recoveredKg).toBe(40);
    expect(esg.divertedKg).toBe(40);
  });

  it('folds recovered waste-bank weight into the stream breakdown', () => {
    const esg = computeEsg(
      [{ status: 'completed', waste_type: 'recyclable', actual_weight_kg: 10 }],
      [{ payment_status: 'completed', grade: 'A', weight_kg: 25, waste_category: 'plastic' }],
    );
    expect(esg.byStream.recyclable).toBe(10);
    expect(esg.byStream.plastic).toBe(25);
  });
});
