// Central region / locale / currency configuration.
// Foundation for multi-region scale: replaces values that are currently
// hard-coded across pages and optimisers (UGX, Kampala map centre) with a
// single source of truth that can later be driven per-tenant.

export const REGION = {
  currency: 'UGX',
  locale: 'en-UG',
  // Default map centre used when an entity has no coordinates yet.
  mapCenter: { lat: 0.3163, lng: 32.5811 },
  country: 'UG',
};

// Format a money amount in the region currency. Amounts are stored as whole
// currency units (e.g. amount_ugx), so no minor-unit division is applied.
export function formatCurrency(amount, { currency = REGION.currency, locale = REGION.locale } = {}) {
  const n = Number(amount) || 0;
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
  } catch {
    // Fallback if the runtime lacks the currency/locale data.
    return `${n.toLocaleString()} ${currency}`;
  }
}

// Map centre, optionally overridden per tenant settings (future use).
export function getMapCenter(tenant) {
  const lat = tenant?.default_lat;
  const lng = tenant?.default_lng;
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  return REGION.mapCenter;
}

// Resolve the effective region for a tenant, merging tenant overrides over the
// platform defaults. This is the seam multi-region rollout builds on: per-tenant
// currency/locale/country come from tenant settings; everything falls back to
// REGION. See docs/MULTI_REGION.md.
export function resolveRegion(tenant) {
  return {
    currency: tenant?.currency || REGION.currency,
    locale: tenant?.locale || REGION.locale,
    country: tenant?.country || REGION.country,
    mapCenter: getMapCenter(tenant),
  };
}

// Tenant-aware currency formatting (uses the tenant's currency/locale).
export function formatCurrencyForTenant(amount, tenant) {
  const { currency, locale } = resolveRegion(tenant);
  return formatCurrency(amount, { currency, locale });
}

