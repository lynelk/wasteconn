import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  clampLimit,
  hasNextPage,
  getPageSlice,
  pageCount,
  dedupeById,
} from '@/lib/pagination';

describe('clampLimit', () => {
  it('falls back for invalid input', () => {
    expect(clampLimit(undefined)).toBe(DEFAULT_PAGE_SIZE);
    expect(clampLimit(0)).toBe(DEFAULT_PAGE_SIZE);
    expect(clampLimit(-5)).toBe(DEFAULT_PAGE_SIZE);
    expect(clampLimit('abc')).toBe(DEFAULT_PAGE_SIZE);
    expect(clampLimit(undefined, 10)).toBe(10);
  });

  it('caps at MAX_PAGE_SIZE and floors fractions', () => {
    expect(clampLimit(10_000)).toBe(MAX_PAGE_SIZE);
    expect(clampLimit(25.9)).toBe(25);
    expect(clampLimit(100)).toBe(100);
  });
});

describe('hasNextPage', () => {
  it('is true when a full page is returned', () => {
    expect(hasNextPage(new Array(50), 50)).toBe(true);
    expect(hasNextPage(new Array(49), 50)).toBe(false);
  });
  it('is false for non-arrays', () => {
    expect(hasNextPage(null, 50)).toBe(false);
  });
});

describe('getPageSlice', () => {
  const items = Array.from({ length: 10 }, (_, i) => i);
  it('slices by 1-based page', () => {
    expect(getPageSlice(items, 1, 4)).toEqual([0, 1, 2, 3]);
    expect(getPageSlice(items, 2, 4)).toEqual([4, 5, 6, 7]);
    expect(getPageSlice(items, 3, 4)).toEqual([8, 9]);
  });
  it('treats invalid pages as page 1', () => {
    expect(getPageSlice(items, 0, 4)).toEqual([0, 1, 2, 3]);
  });
});

describe('pageCount', () => {
  it('computes ceil and is at least 1', () => {
    expect(pageCount(0, 50)).toBe(1);
    expect(pageCount(50, 50)).toBe(1);
    expect(pageCount(51, 50)).toBe(2);
    expect(pageCount(120, 50)).toBe(3);
  });
});

describe('dedupeById', () => {
  it('keeps first occurrence and drops idless/dupes', () => {
    expect(dedupeById([{ id: 1 }, { id: 2 }, { id: 1 }, {}, null])).toEqual([{ id: 1 }, { id: 2 }]);
  });
});
