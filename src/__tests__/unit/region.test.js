import { describe, it, expect } from 'vitest';
import { REGION, formatCurrency, getMapCenter, resolveRegion, formatCurrencyForTenant } from '@/lib/region';

describe('formatCurrency', () => {
  it('formats whole-unit amounts in the region currency', () => {
    const out = formatCurrency(50000);
    expect(out).toMatch(/50,000/);
    // UGX renders as the "USh" symbol (or the code, depending on ICU data).
    expect(out).toMatch(/USh|UGX/);
  });
  it('treats invalid input as zero', () => {
    expect(formatCurrency(undefined)).toMatch(/0/);
  });
  it('honours an explicit currency override', () => {
    expect(formatCurrency(10, { currency: 'USD', locale: 'en-US' })).toMatch(/\$10/);
  });
});

describe('getMapCenter', () => {
  it('returns the region default when no tenant coords', () => {
    expect(getMapCenter()).toEqual(REGION.mapCenter);
    expect(getMapCenter({})).toEqual(REGION.mapCenter);
  });
  it('uses tenant coordinates when present', () => {
    expect(getMapCenter({ default_lat: 1.5, default_lng: 33 })).toEqual({ lat: 1.5, lng: 33 });
  });
});

describe('resolveRegion', () => {
  it('falls back to platform defaults', () => {
    expect(resolveRegion()).toEqual({
      currency: REGION.currency, locale: REGION.locale, country: REGION.country, mapCenter: REGION.mapCenter,
    });
  });
  it('merges tenant overrides', () => {
    const r = resolveRegion({ currency: 'KES', locale: 'en-KE', country: 'KE', default_lat: -1.29, default_lng: 36.82 });
    expect(r).toEqual({ currency: 'KES', locale: 'en-KE', country: 'KE', mapCenter: { lat: -1.29, lng: 36.82 } });
  });
});

describe('formatCurrencyForTenant', () => {
  it("formats in the tenant's currency", () => {
    expect(formatCurrencyForTenant(10, { currency: 'USD', locale: 'en-US' })).toMatch(/\$10/);
  });
  it('falls back to platform currency when tenant has none', () => {
    expect(formatCurrencyForTenant(5000)).toMatch(/5,000/);
  });
});
