import { logger } from '@/lib/logger';

// Uptrace (OpenTelemetry/OTLP) monitoring — RUM Web Vitals + error capture.
//
// Fully env-gated and fail-safe: with no `VITE_UPTRACE_DSN` it is a no-op
// (metrics/errors still go to the logger). It posts OTLP/HTTP JSON directly to
// Uptrace, so it needs no heavy OpenTelemetry SDK in the browser bundle and can
// never throw into application code.

const SERVICE_NAME = 'wasteconn-web';

let config = null; // { endpoint, header, resourceAttributes }
let initialised = false;

// ── Pure helpers (unit-tested) ──────────────────────────────────────────────

// Parse an Uptrace DSN (https://<token>@<host>/<project>) into an OTLP target.
export function parseUptraceDsn(dsn) {
  if (!dsn || typeof dsn !== 'string') return null;
  try {
    const u = new URL(dsn);
    return { endpoint: u.origin, header: { 'uptrace-dsn': dsn } };
  } catch {
    return null;
  }
}

// Convert a flat attribute object to OTLP keyValue list with typed values.
export function toOtlpAttributes(attrs = {}) {
  return Object.entries(attrs)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([key, v]) => {
      let value;
      if (typeof v === 'number') value = { doubleValue: v };
      else if (typeof v === 'boolean') value = { boolValue: v };
      else value = { stringValue: String(v) };
      return { key, value };
    });
}

function resourceBlock(resourceAttributes) {
  return { attributes: toOtlpAttributes(resourceAttributes) };
}

export function buildOtlpLog({ message, severity = 'ERROR', attributes = {}, resourceAttributes = {}, timeUnixNano }) {
  const severityNumber = severity === 'WARN' ? 13 : severity === 'INFO' ? 9 : 17; // ERROR=17
  return {
    resourceLogs: [{
      resource: resourceBlock(resourceAttributes),
      scopeLogs: [{
        scope: { name: SERVICE_NAME },
        logRecords: [{
          timeUnixNano: String(timeUnixNano ?? Date.now() * 1e6),
          severityNumber,
          severityText: severity,
          body: { stringValue: String(message ?? '') },
          attributes: toOtlpAttributes(attributes),
        }],
      }],
    }],
  };
}

export function buildOtlpMetric({ name, value, unit = '', attributes = {}, resourceAttributes = {}, timeUnixNano }) {
  return {
    resourceMetrics: [{
      resource: resourceBlock(resourceAttributes),
      scopeMetrics: [{
        scope: { name: SERVICE_NAME },
        metrics: [{
          name,
          unit,
          gauge: {
            dataPoints: [{
              asDouble: Number(value) || 0,
              timeUnixNano: String(timeUnixNano ?? Date.now() * 1e6),
              attributes: toOtlpAttributes(attributes),
            }],
          },
        }],
      }],
    }],
  };
}

// ── Transport (fail-safe) ───────────────────────────────────────────────────

function send(path, payload) {
  if (!config || typeof fetch === 'undefined') return;
  try {
    fetch(`${config.endpoint}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...config.header },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // never throw from monitoring
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

export function captureError(error, context = {}) {
  const message = error?.message || String(error);
  logger.error('monitoring.error', { message, ...context });
  if (!config) return;
  send('/v1/logs', buildOtlpLog({
    message,
    severity: context.severity === 'fatal' ? 'ERROR' : (context.severity || 'ERROR').toUpperCase(),
    attributes: { source: context.source || 'manual', stack: (error?.stack || '').slice(0, 1000) },
    resourceAttributes: config.resourceAttributes,
  }));
}

export function captureMetric(name, value, attributes = {}) {
  logger.info('monitoring.metric', { name, value });
  if (!config) return;
  send('/v1/metrics', buildOtlpMetric({
    name, value, unit: 'ms', attributes, resourceAttributes: config.resourceAttributes,
  }));
}

export function initMonitoring() {
  if (initialised || typeof window === 'undefined') return;
  initialised = true;

  const env = import.meta.env || {};
  const parsed = parseUptraceDsn(env.VITE_UPTRACE_DSN);
  if (parsed) {
    config = {
      ...parsed,
      resourceAttributes: {
        'service.name': SERVICE_NAME,
        'service.version': env.VITE_APP_RELEASE || 'dev',
        'deployment.environment': env.MODE || 'production',
      },
    };
  }

  // Web Vitals collection is skipped — package not installed in this build.
}