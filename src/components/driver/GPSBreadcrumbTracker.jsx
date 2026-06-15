/**
 * GPSBreadcrumbTracker — On-device GPS path recorder for micro-route ML learning.
 *
 * Collects GPS breadcrumbs during a job and stores them keyed by job ID.
 * Breadcrumbs are used to:
 *   - Learn driver-preferred micro-routes via NavigationAssist
 *   - Estimate distance / fuel efficiency
 *   - Provide proof-of-service GPS trail uploaded on job completion
 */

const BREADCRUMB_KEY_PREFIX = 'nlswms_gps_trail_';
const BREADCRUMB_KEY_DB = 'nlswms_gps_crypto_db';
const BREADCRUMB_KEY_STORE = 'keys';
const BREADCRUMB_KEY_ID = 'gps_breadcrumb_key_v1';
const ENCRYPTED_PAYLOAD_VERSION = 1;

function openBreadcrumbKeyDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(BREADCRUMB_KEY_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(BREADCRUMB_KEY_STORE)) {
        db.createObjectStore(BREADCRUMB_KEY_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getOrCreateBreadcrumbCryptoKey() {
  const db = await openBreadcrumbKeyDb();
  try {
    const existing = await new Promise((resolve, reject) => {
      const tx = db.transaction(BREADCRUMB_KEY_STORE, 'readonly');
      const store = tx.objectStore(BREADCRUMB_KEY_STORE);
      const req = store.get(BREADCRUMB_KEY_ID);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    if (existing) return existing;

    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    await new Promise((resolve, reject) => {
      const tx = db.transaction(BREADCRUMB_KEY_STORE, 'readwrite');
      const store = tx.objectStore(BREADCRUMB_KEY_STORE);
      const req = store.put(key, BREADCRUMB_KEY_ID);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    return key;
  } finally {
    db.close();
  }
}

function bytesToBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function base64ToBytes(base64) {
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function encryptBreadcrumbs(plainText) {
  const key = await getOrCreateBreadcrumbCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plainText);
  const cipherBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return {
    v: ENCRYPTED_PAYLOAD_VERSION,
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(cipherBuffer)),
  };
}

async function decryptBreadcrumbs(payload) {
  const key = await getOrCreateBreadcrumbCryptoKey();
  const iv = base64ToBytes(payload.iv);
  const data = base64ToBytes(payload.data);
  const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(plainBuffer);
}

/**
 * Append a GPS point to the in-progress job's trail.
 * Each point: { lat, lng, ts, speed_kmh?, heading? }
 */
export async function appendBreadcrumb(jobId, lat, lng, extras = {}) {
  if (!jobId) return;
  const key = `${BREADCRUMB_KEY_PREFIX}${jobId}`;
  try {
    const existing = await getBreadcrumbs(jobId);
    existing.push({ lat, lng, ts: Date.now(), ...extras });
    // Cap at 500 points per job (~2h at 15s intervals)
    const capped = existing.length > 500 ? existing.slice(-500) : existing;
    const encryptedPayload = await encryptBreadcrumbs(JSON.stringify(capped));
    localStorage.setItem(key, JSON.stringify(encryptedPayload));
  } catch (_) {}
}

/**
 * Retrieve the GPS trail for a job. Returns array of breadcrumb points.
 */
export async function getBreadcrumbs(jobId) {
  if (!jobId) return [];
  try {
    const raw = localStorage.getItem(`${BREADCRUMB_KEY_PREFIX}${jobId}`);
    if (!raw) return [];

    const parsed = JSON.parse(raw);

    // Backward compatibility for previously stored plaintext arrays.
    if (Array.isArray(parsed)) return parsed;

    if (parsed && parsed.v === ENCRYPTED_PAYLOAD_VERSION && parsed.iv && parsed.data) {
      const decrypted = await decryptBreadcrumbs(parsed);
      return JSON.parse(decrypted || '[]');
    }

    return [];
  } catch {
    return [];
  }
}

/**
 * Clear breadcrumbs for a job (call after successful upload / completion).
 */
export function clearBreadcrumbs(jobId) {
  if (!jobId) return;
  localStorage.removeItem(`${BREADCRUMB_KEY_PREFIX}${jobId}`);
}

/**
 * Estimate total distance (km) from a breadcrumb trail using Haversine.
 */
export function estimateDistanceKm(breadcrumbs) {
  if (!breadcrumbs || breadcrumbs.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < breadcrumbs.length; i++) {
    const prev = breadcrumbs[i - 1];
    const curr = breadcrumbs[i];
    const R = 6371;
    const dLat = (curr.lat - prev.lat) * Math.PI / 180;
    const dLng = (curr.lng - prev.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(prev.lat*Math.PI/180)*Math.cos(curr.lat*Math.PI/180)*Math.sin(dLng/2)**2;
    total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }
  return Math.round(total * 100) / 100;
}