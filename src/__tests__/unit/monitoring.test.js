import { describe, it, expect } from 'vitest';
import { parseUptraceDsn, toOtlpAttributes, buildOtlpLog, buildOtlpMetric } from '@/lib/monitoring';

describe('parseUptraceDsn', () => {
  it('returns null for empty/invalid input', () => {
    expect(parseUptraceDsn('')).toBeNull();
    expect(parseUptraceDsn(undefined)).toBeNull();
    expect(parseUptraceDsn('not a url')).toBeNull();
  });
  it('extracts the origin endpoint and DSN header', () => {
    const dsn = 'https://token123@api.uptrace.dev/2';
    expect(parseUptraceDsn(dsn)).toEqual({
      endpoint: 'https://api.uptrace.dev',
      header: { 'uptrace-dsn': dsn },
    });
  });
});

describe('toOtlpAttributes', () => {
  it('types values and drops null/undefined', () => {
    expect(toOtlpAttributes({ a: 'x', b: 3, c: true, d: null, e: undefined })).toEqual([
      { key: 'a', value: { stringValue: 'x' } },
      { key: 'b', value: { doubleValue: 3 } },
      { key: 'c', value: { boolValue: true } },
    ]);
  });
});

describe('buildOtlpLog', () => {
  it('produces an OTLP logs envelope with severity mapping', () => {
    const out = buildOtlpLog({ message: 'boom', severity: 'ERROR', timeUnixNano: 5 });
    const rec = out.resourceLogs[0].scopeLogs[0].logRecords[0];
    expect(rec.body).toEqual({ stringValue: 'boom' });
    expect(rec.severityNumber).toBe(17);
    expect(rec.timeUnixNano).toBe('5');
  });
});

describe('buildOtlpMetric', () => {
  it('produces an OTLP gauge metric', () => {
    const out = buildOtlpMetric({ name: 'web_vitals.LCP', value: 1234.5, timeUnixNano: 9 });
    const m = out.resourceMetrics[0].scopeMetrics[0].metrics[0];
    expect(m.name).toBe('web_vitals.LCP');
    expect(m.gauge.dataPoints[0].asDouble).toBe(1234.5);
    expect(m.gauge.dataPoints[0].timeUnixNano).toBe('9');
  });
});
