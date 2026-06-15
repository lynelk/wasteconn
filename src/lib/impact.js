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

// Waste types that count as diverted from landfill/open dumping.
export const DIVERTED_WASTE_TYPES = ['recyclable', 'organic'];

function pickupWeight(p) {
  return typeof p.actual_weight_kg === 'number' && p.actual_weight_kg > 0
    ? p.actual_weight_kg
    : DEFAULT_KG_PER_PICKUP;
}

// Tenant/operator-level ESG roll-up across collections and waste-bank intake.
// `wasteBankTxns` are WasteBankTransaction rows (recovered recyclables); every
// kg recovered there counts as diverted.
export function computeEsg(pickups = [], wasteBankTxns = []) {
  const completed = pickups.filter(p => p.status === 'completed');
  const collectedKg = completed.reduce((s, p) => s + pickupWeight(p), 0);

  const divertedFromCollection = completed
    .filter(p => DIVERTED_WASTE_TYPES.includes(p.waste_type))
    .reduce((s, p) => s + pickupWeight(p), 0);

  const recoveredKg = wasteBankTxns
    .filter(t => t.payment_status === 'completed')
    .reduce((s, t) => s + (t.weight_kg || 0), 0);

  const totalHandledKg = collectedKg + recoveredKg;
  const totalDivertedKg = divertedFromCollection + recoveredKg;
  const diversionRate = totalHandledKg > 0 ? totalDivertedKg / totalHandledKg : 0;

  // Breakdown by waste stream (kg) for charts.
  const byStream = {};
  for (const p of completed) {
    const key = p.waste_type || 'general';
    byStream[key] = (byStream[key] || 0) + pickupWeight(p);
  }

  return {
    collections: completed.length,
    collectedKg: Math.round(collectedKg),
    recoveredKg: Math.round(recoveredKg),
    totalHandledKg: Math.round(totalHandledKg),
    divertedKg: Math.round(totalDivertedKg),
    diversionRatePct: Math.round(diversionRate * 1000) / 10,
    co2AvoidedKg: Math.round(totalDivertedKg * CO2_PER_KG),
    co2AvoidedTonnes: Math.round(totalDivertedKg * CO2_PER_KG / 100) / 10,
    byStream,
  };
}
