// Geospatial helpers (pure, unit-tested). The same math is inlined into the
// self-contained base44 functions computeEta and wialonSync — keep in sync.

const EARTH_RADIUS_M = 6_371_000;

export function haversineMeters(aLat, aLng, bLat, bLng) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function pointToSegmentMeters(pLat, pLng, aLat, aLng, bLat, bLng) {
  const toRad = (d) => (d * Math.PI) / 180;
  const refLat = toRad((aLat + bLat) / 2);
  const x = (lng) => toRad(lng) * Math.cos(refLat) * EARTH_RADIUS_M;
  const y = (lat) => toRad(lat) * EARTH_RADIUS_M;

  const px = x(pLng), py = y(pLat);
  const ax = x(aLng), ay = y(aLat);
  const bx = x(bLng), by = y(bLat);

  const dx = bx - ax, dy = by - ay;
  const segLenSq = dx * dx + dy * dy;
  if (segLenSq === 0) return Math.hypot(px - ax, py - ay);

  let t = ((px - ax) * dx + (py - ay) * dy) / segLenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

export function distanceToPolylineMeters(pLat, pLng, coords) {
  if (!coords || coords.length === 0) return Infinity;
  if (coords.length === 1) return haversineMeters(pLat, pLng, coords[0][1], coords[0][0]);
  let min = Infinity;
  for (let i = 0; i < coords.length - 1; i++) {
    const [aLng, aLat] = coords[i];
    const [bLng, bLat] = coords[i + 1];
    const d = pointToSegmentMeters(pLat, pLng, aLat, aLng, bLat, bLng);
    if (d < min) min = d;
  }
  return min;
}

// Estimate ETA minutes from distance and current speed, with an urban speed floor.
export function estimateEtaMinutes(distanceMeters, speedKmh, floorKmh = 15) {
  const effectiveKmh = Math.max(speedKmh || 0, floorKmh);
  const hours = distanceMeters / 1000 / effectiveKmh;
  return Math.max(1, Math.round(hours * 60));
}
