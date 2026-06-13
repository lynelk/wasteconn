// Shared metadata for external integrations, plus a freshness-based status helper.
// Used by IntegrationsHub (catalogue) and IntegrationHealth (status grid).

export const INTEGRATIONS = [
  {
    id: 'citoconnect',
    name: 'CitoConnect',
    description: 'Payment gateway & SMS service — MTN MoMo, Airtel Money, Yo! Payments, bulk SMS.',
    logo: '🔗',
    features: ['SMS Sending', 'Payment Collection', 'Fund Disbursement', 'KYC-Gated Payouts', 'Webhooks'],
    docsUrl: 'https://citoconnect.base44.app/api-docs',
  },
  {
    id: 'wialon',
    name: 'Wialon Telematics',
    description: 'Real-time vehicle GPS tracking, route deviations, idling alerts and telemetry sync.',
    logo: '📡',
    features: ['GPS Tracking', 'Route Telemetry', 'Idling Alerts', 'Deviation Alerts'],
    docsUrl: null,
  },
  {
    id: 'yopayments',
    name: 'Yo! Payments',
    description: 'Direct Yo! Payments integration for mobile money collection.',
    logo: '💳',
    features: ['MoMo Collection', 'Payment Status'],
    docsUrl: null,
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks Online',
    description: 'Accounting sync — push invoices and payments, pull reconciliation data.',
    logo: '📒',
    features: ['Invoice Push', 'Payment Sync', 'Live FX Rate'],
    docsUrl: null,
  },
  {
    id: 'merx365',
    name: 'Merx365',
    description: 'External data integration for extended operational reporting.',
    logo: '📊',
    features: ['Data Sync', 'Reporting'],
    docsUrl: null,
  },
];

// Returns 'green' | 'yellow' | 'red' | 'unknown' from the age of the last event.
// Fresh within `freshHours` = green; within `staleHours` = yellow; older = red.
export function freshnessStatus(lastTimestamp, { freshHours = 6, staleHours = 48 } = {}) {
  if (!lastTimestamp) return 'unknown';
  const ageHours = (Date.now() - new Date(lastTimestamp).getTime()) / 3_600_000;
  if (Number.isNaN(ageHours)) return 'unknown';
  if (ageHours <= freshHours) return 'green';
  if (ageHours <= staleHours) return 'yellow';
  return 'red';
}

export const STATUS_META = {
  green: { label: 'Healthy', dot: 'bg-green-500', text: 'text-green-600' },
  yellow: { label: 'Stale', dot: 'bg-yellow-500', text: 'text-yellow-600' },
  red: { label: 'Down', dot: 'bg-red-500', text: 'text-red-600' },
  unknown: { label: 'No data', dot: 'bg-gray-400', text: 'text-muted-foreground' },
};
