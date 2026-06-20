/**
 * offlineDB — lightweight IndexedDB wrapper for offline-first WasteBank & DriverApp operations.
 * Supports: transactions, pickups, evidence (photos as base64), pending sync queue.
 */

const DB_NAME = 'nlswms_offline';
const DB_VERSION = 4;

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      // Waste bank offline transactions
      if (!db.objectStoreNames.contains('wbt_queue')) {
        const store = db.createObjectStore('wbt_queue', { keyPath: 'local_id' });
        store.createIndex('synced', 'synced', { unique: false });
      }
      // Driver pickup evidence
      if (!db.objectStoreNames.contains('pickup_evidence')) {
        db.createObjectStore('pickup_evidence', { keyPath: 'local_id' });
      }
      // Driver jobs cache
      if (!db.objectStoreNames.contains('driver_jobs')) {
        db.createObjectStore('driver_jobs', { keyPath: 'id' });
      }
      // Generic pending sync actions
      if (!db.objectStoreNames.contains('sync_queue')) {
        const sq = db.createObjectStore('sync_queue', { keyPath: 'local_id' });
        sq.createIndex('entity', 'entity', { unique: false });
      }
      // Generic entity row cache (powers offline EntitySelect pickers).
      // Scoped by tenant via the 'scope_entity' index. Recreated when upgrading
      // from the unscoped v3 layout so reads are always tenant-isolated.
      if (db.objectStoreNames.contains('entity_cache')) {
        db.deleteObjectStore('entity_cache');
      }
      const ec = db.createObjectStore('entity_cache', { keyPath: 'cache_key' });
      ec.createIndex('scope_entity', 'scope_entity', { unique: false });
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function tx(storeName, mode = 'readonly') {
  return openDB().then(db => db.transaction(storeName, mode).objectStore(storeName));
}

function promisify(req) {
  return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
}

// ─── Waste Bank Transaction Queue ──────────────────────────────────────────

export async function queueWBTransaction(data) {
  const store = await tx('wbt_queue', 'readwrite');
  const local_id = `wbt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return promisify(store.put({ local_id, synced: false, created_at: new Date().toISOString(), ...data }));
}

export async function getPendingWBTransactions() {
  const store = await tx('wbt_queue', 'readonly');
  return promisify(store.index('synced').getAll(false));
}

export async function markWBTransactionSynced(local_id) {
  const store = await tx('wbt_queue', 'readwrite');
  const rec = await promisify(store.get(local_id));
  if (rec) return promisify(store.put({ ...rec, synced: true }));
}

export async function clearSyncedWBTransactions() {
  const store = await tx('wbt_queue', 'readwrite');
  const all = await promisify(store.getAll());
  for (const rec of all.filter(r => r.synced)) {
    store.delete(rec.local_id);
  }
}

// ─── Pickup Evidence (photos as dataURLs) ──────────────────────────────────

export async function savePickupEvidence(pickupId, dataUrl, gps) {
  const store = await tx('pickup_evidence', 'readwrite');
  const local_id = `ev_${pickupId}_${Date.now()}`;
  return promisify(store.put({ local_id, pickup_id: pickupId, data_url: dataUrl, gps, synced: false, created_at: new Date().toISOString() }));
}

export async function getEvidenceForPickup(pickupId) {
  const store = await tx('pickup_evidence', 'readonly');
  const all = await promisify(store.getAll());
  return all.filter(e => e.pickup_id === pickupId);
}

// ─── Driver Jobs Cache ──────────────────────────────────────────────────────

export async function cacheDriverJobs(jobs) {
  const store = await tx('driver_jobs', 'readwrite');
  for (const job of jobs) store.put(job);
}

export async function getCachedDriverJobs() {
  const store = await tx('driver_jobs', 'readonly');
  return promisify(store.getAll());
}

export async function updateCachedDriverJob(id, changes) {
  const store = await tx('driver_jobs', 'readwrite');
  const job = await promisify(store.get(id));
  if (job) return promisify(store.put({ ...job, ...changes }));
}

// ─── Generic Sync Queue ─────────────────────────────────────────────────────

export async function enqueueAction(entity, action, payload) {
  const store = await tx('sync_queue', 'readwrite');
  const local_id = `sq_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return promisify(store.put({ local_id, entity, action, payload, synced: false, created_at: new Date().toISOString() }));
}

export async function getPendingActions() {
  const store = await tx('sync_queue', 'readonly');
  const all = await promisify(store.getAll());
  return all.filter(a => !a.synced);
}

export async function markActionSynced(local_id) {
  const store = await tx('sync_queue', 'readwrite');
  const rec = await promisify(store.get(local_id));
  if (rec) return promisify(store.put({ ...rec, synced: true }));
}

// ─── Generic Entity Cache (offline EntitySelect pickers) ────────────────────
// Rows fetched online are cached here so async pickers (EntitySelect) can still
// resolve a selection (e.g. a customer_id) when offline — without which an
// offline-capable form like the WasteBank transaction form can't be completed.

export async function cacheEntities(entity, rows = [], scope = '') {
  if (!entity || !Array.isArray(rows) || rows.length === 0) return;
  try {
    const store = await tx('entity_cache', 'readwrite');
    const now = new Date().toISOString();
    const s = scope || '';
    for (const row of rows) {
      if (!row?.id) continue;
      // Scope by tenant (or any caller-supplied scope) so a shared device never
      // surfaces another tenant's cached rows offline.
      store.put({ cache_key: `${s}:${entity}:${row.id}`, scope_entity: `${s}:${entity}`, entity, scope: s, id: row.id, row, cached_at: now });
    }
  } catch { /* caching is best-effort; never block the online path */ }
}

export async function getCachedEntities(entity, scope = '') {
  try {
    const store = await tx('entity_cache', 'readonly');
    const all = await promisify(store.index('scope_entity').getAll(`${scope || ''}:${entity}`));
    return all.map((r) => r.row);
  } catch {
    return [];
  }
}

// Drop the entire entity cache (e.g. on logout) so cached rows don't leak across
// accounts on a shared device.
export async function clearEntityCache() {
  try {
    const store = await tx('entity_cache', 'readwrite');
    return promisify(store.clear());
  } catch {
    /* best-effort */
  }
}