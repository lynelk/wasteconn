# Multi-region & internationalisation — rollout plan

_Status: planned · Foundation in `src/lib/region.js` + `src/lib/i18n.js`_

WasteConn currently ships UGX currency and a Kampala-centred map as platform
defaults. To serve multiple cities/countries on one platform, region settings
must become **per-tenant** rather than hard-coded.

## What exists today

- **`src/lib/region.js`** — single source of truth for currency / locale /
  country / map centre, now with tenant-aware resolvers:
  - `resolveRegion(tenant)` — merges tenant overrides over platform defaults.
  - `formatCurrencyForTenant(amount, tenant)` / `getMapCenter(tenant)`.
- **`src/lib/i18n.js`** — translation layer already used by the customer app
  (`useTranslation`, `LANGUAGES`).

## Gaps to close

1. **Tenant settings schema.** Add `currency`, `locale`, `country`,
   `default_lat`, `default_lng` (and optional `timezone`) to the `Tenant` entity,
   surfaced in tenant admin.
2. **Frontend adoption.** Replace remaining hard-coded `UGX` / `toLocaleString()`
   money rendering and Kampala map fallbacks with `formatCurrencyForTenant` /
   `getMapCenter`, threading the current tenant through (via an auth/tenant
   context provider).
3. **Backend functions.** The route optimisers (`aiRouteOptimiser`,
   `fillLevelRouteOptimiser`) hard-code Kampala fallback coordinates and the
   reminders/invoicing assume UGX. Parameterise these by the tenant's region.
4. **Timezone correctness.** Scheduled jobs (invoicing, reminders, SLA timers)
   should honour each tenant's timezone, not a single server tz.
5. **i18n coverage.** Extend `i18n.js` strings beyond the customer app to the
   operator console; add locales as markets are added.
6. **Data residency.** If required per country, confirm with Base44 whether
   tenant data can be pinned to a region; document constraints.

## Phased rollout

1. **Schema + settings UI** — add region fields to `Tenant`; default to current
   UGX/Kampala so nothing changes for existing tenants.
2. **Frontend money/maps** — adopt the `region.js` tenant resolvers everywhere
   (mechanical, guarded by the existing tests).
3. **Backend parameterisation** — optimisers + scheduled jobs read tenant region
   + timezone.
4. **New-market onboarding** — add locale strings + currency, pilot one
   non-UGX tenant end-to-end (k6 + manual smoke), then GA.

## Acceptance

- A tenant configured for `[e.g. KES / en-KE / Nairobi]` shows correct currency,
  number/date formats, map centre, and timezone across operator + customer apps,
  with **zero** change to existing UGX tenants.
