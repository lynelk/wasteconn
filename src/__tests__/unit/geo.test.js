import { describe, it, expect } from 'vitest';
import { haversineMeters, pointToSegmentMeters, distanceToPolylineMeters, estimateEtaMinutes } from '@/lib/geo';

describe('haversineMeters', () => {
  it('is zero for identical points', () => {
    expect(haversineMeters(0.3476, 32.5825, 0.3476, 32.5825)).toBe(0);
  });

  it('approximates ~1.11km per 0.01 degree of latitude', () => {
    const d = haversineMeters(0, 32, 0.01, 32);
    expect(d).toBeGreaterThan(1100);
    expect(d).toBeLessThan(1120);
  });
});

describe('pointToSegmentMeters', () => {
  it('returns ~0 when the point lies on the segment', () => {
    const d = pointToSegmentMeters(0.005, 32, 0, 32, 0.01, 32);
    expect(d).toBeLessThan(1);
  });

  it('measures perpendicular offset from the segment', () => {
    // point 0.01deg east of a north-south segment ≈ 1.11km
    const d = pointToSegmentMeters(0.005, 32.01, 0, 32, 0.01, 32);
    expect(d).toBeGreaterThan(1000);
    expect(d).toBeLessThan(1200);
  });

  it('clamps to the nearest endpoint beyond the segment', () => {
    const d = pointToSegmentMeters(0.02, 32, 0, 32, 0.01, 32);
    const endpointDist = haversineMeters(0.02, 32, 0.01, 32);
    expect(Math.abs(d - endpointDist)).toBeLessThan(5);
  });
});

describe('distanceToPolylineMeters', () => {
  const route = [[32, 0], [32, 0.01], [32.01, 0.01]]; // [lng,lat] GeoJSON order

  it('returns Infinity for empty route', () => {
    expect(distanceToPolylineMeters(0, 32, [])).toBe(Infinity);
  });

  it('finds the minimum distance across all segments', () => {
    const onRoute = distanceToPolylineMeters(0.005, 32, route);
    expect(onRoute).toBeLessThan(1);
  });

  it('flags a point far from the route', () => {
    // ~5.5km east of the route's eastern-most corner
    const off = distanceToPolylineMeters(0.005, 32.06, route);
    expect(off).toBeGreaterThan(4000);
  });
});

describe('estimateEtaMinutes', () => {
  it('uses the urban speed floor when driver is stationary', () => {
    // 1.5km at floor 15km/h = 6 min
    expect(estimateEtaMinutes(1500, 0)).toBe(6);
  });

  it('uses actual speed when above the floor', () => {
    // 10km at 60km/h = 10 min
    expect(estimateEtaMinutes(10000, 60)).toBe(10);
  });

  it('never returns less than 1 minute', () => {
    expect(estimateEtaMinutes(10, 60)).toBe(1);
  });
});
