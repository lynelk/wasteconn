// Environmental impact estimation from pickup history.
// Conservative defaults: 15 kg per collection when actual weight unknown,
// 0.5 kg CO2e avoided per kg of waste diverted from open dumping/burning.

export const DEFAULT_KG_PER_PICKUP = 15;
export const CO2_PER_KG = 0.5;

export function computeImpact(pickups = []) {
  const completed = pickups.filter(p => p.status === 'completed');
  const totalKg = completed.reduce(
    (s, p) => s + (typeof p.actual_weight_kg === 'number' && p.actual_weight_kg > 0 ? p.actual_weight_kg : DEFAULT_KG_PER_PICKUP),
    0
  );
  return {
    completedPickups: completed.length,
    kgDiverted: Math.round(totalKg),
    co2SavedKg: Math.round(totalKg * CO2_PER_KG),
  };
}
