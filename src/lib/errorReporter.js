import { base44 } from '@/api/base44Client';
import { logger } from '@/lib/logger';
import { captureError } from '@/lib/monitoring';

// Persists client-side errors to the ClientErrorLog entity so production
// failures are visible to admins. Deduped and batched to avoid write storms.

const MAX_BATCH = 10;
const FLUSH_INTERVAL_MS = 30_000;

let queue = [];
let seen = new Set();
let flushTimer = null;
let initialised = false;

async function flush() {
  if (queue.length === 0) return;
  const batch = queue.splice(0, MAX_BATCH);
  for (const entry of batch) {
    try {
      await base44.entities.ClientErrorLog.create(entry);
    } catch {
      // Persistence is best-effort; never let error reporting itself throw
    }
  }
}

export function reportError(error, context = {}) {
  try {
    const message = error?.message || String(error);
    const key = `${message}:${context.source || ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (seen.size > 200) seen = new Set();

    queue.push({
      message: message.slice(0, 500),
      stack: (error?.stack || '').slice(0, 2000),
      url: typeof window !== 'undefined' ? window.location.href : '',
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      severity: context.severity || 'error',
      source: context.source || 'manual',
      occurred_at: new Date().toISOString(),
    });
    if (queue.length > 50) queue = queue.slice(-50);

    logger.error('client.error.captured', { message, source: context.source });
    captureError(error, context);
  } catch {
    // never throw from the reporter
  }
}

export function initErrorReporter() {
  if (initialised || typeof window === 'undefined') return;
  initialised = true;

  window.addEventListener('error', (event) => {
    reportError(event.error || new Error(event.message), { source: 'window.onerror' });
  });

  window.addEventListener('unhandledrejection', (event) => {
    reportError(event.reason instanceof Error ? event.reason : new Error(String(event.reason)), {
      source: 'unhandledrejection',
    });
  });

  flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);
  window.addEventListener('beforeunload', () => {
    clearInterval(flushTimer);
  });
}
