import { useState, useCallback } from 'react';

// Lightweight i18n for customer-facing surfaces (CustomerApp, PayPage).
// Admin UI remains English. Languages: English (en), Luganda (lg), Swahili (sw).

const STORAGE_KEY = 'nlswms_lang';

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'lg', label: 'Luganda' },
  { code: 'sw', label: 'Kiswahili' },
];

// Maps Customer.preferred_language enum values to language codes
const PREFERRED_LANGUAGE_MAP = { english: 'en', luganda: 'lg', swahili: 'sw' };

export const translations = {
  en: {
    'tabs.history': 'Collection History',
    'tabs.invoices': 'Invoices',
    'tabs.payments': 'Payments',
    'header.portal': 'Customer Portal',
    'header.account': 'Acct',
    'stats.pickups': 'Pickups',
    'stats.pending': 'Pending',
    'stats.dueInvoices': 'Due Invoices',
    'stats.paid': 'Paid',
    'cta.requestPickup': 'Request Extra Pickup',
    'servicePoints.title': 'My Service Points',
    'history.empty': 'No collection history yet.',
    'history.trackDriver': 'Track Driver',
    'invoices.empty': 'No invoices yet.',
    'payments.totalPaid': 'Total paid',
    'payments.statement': 'Statement',
    'payments.empty': 'No payment history yet.',
    'survey.rate': 'Rate your recent pickup',
    'survey.awaiting': 'survey(s) awaiting your response',
    'impact.title': 'My Impact',
    'impact.pickups': 'Collections',
    'impact.kgDiverted': 'kg diverted',
    'impact.co2Saved': 'kg CO₂ saved',
    'referral.title': 'Refer a Friend',
    'referral.description': 'Share your code — you both earn a wallet credit when they make their first payment.',
    'referral.share': 'Share Code',
    'referral.yourCode': 'Your referral code',
    'loyalty.points': 'points',
    'pay.title': 'NLSWMS Payment',
    'pay.subtitle': 'Secure mobile money payment',
    'pay.details': 'Payment Details',
    'pay.customer': 'Customer',
    'pay.invoice': 'Invoice',
    'pay.description': 'Description',
    'pay.amount': 'Amount',
    'pay.expires': 'Expires',
    'pay.phoneLabel': 'Mobile Money Number',
    'pay.phoneHint': 'Enter the MTN MoMo or Airtel Money number to charge.',
    'pay.payButton': 'Pay',
    'pay.processing': 'Processing...',
    'pay.promptHint': 'You will receive a MoMo prompt on your phone to confirm payment.',
    'pay.success': 'Payment Successful!',
    'pay.received': 'Your payment of',
    'pay.receivedSuffix': 'has been received.',
    'pay.receiptSent': 'A receipt has been sent to your phone. Thank you!',
    'pay.linkInvalid': 'Link Invalid',
  },
  lg: {
    'tabs.history': 'Ebyafaayo by\'Okukuŋŋaanya',
    'tabs.invoices': 'Za Invoyisi',
    'tabs.payments': 'Ensasula',
    'header.portal': 'Omukutu gwa Kasitoma',
    'header.account': 'Akawunti',
    'stats.pickups': 'Okukuŋŋaanya',
    'stats.pending': 'Ezirindiridde',
    'stats.dueInvoices': 'Invoyisi Ezisasulwa',
    'stats.paid': 'Ezisasuddwa',
    'cta.requestPickup': 'Saba Okukuŋŋaanya Okulala',
    'servicePoints.title': 'Ebifo Byange',
    'history.empty': 'Tewali byafaayo bya kukuŋŋaanya.',
    'history.trackDriver': 'Londoola Dereeva',
    'invoices.empty': 'Tewali nvoyisi.',
    'payments.totalPaid': 'Omugatte ogusasuddwa',
    'payments.statement': 'Sitatimenti',
    'payments.empty': 'Tewali byafaayo bya nsasula.',
    'survey.rate': 'Wa ekikuŋŋaanyizo kyo amaanyi',
    'survey.awaiting': 'okubuuza okulindiridde okuddamu kwo',
    'impact.title': 'Akakwate Kange',
    'impact.pickups': 'Okukuŋŋaanya',
    'impact.kgDiverted': 'kg eziwoniddwa',
    'impact.co2Saved': 'kg CO₂ eziterekeddwa',
    'referral.title': 'Yita Mukwano Gwo',
    'referral.description': 'Gabana koodi yo — mwembi mufuna ssente ku wallet ng\'asasudde omulundi gwe ogusooka.',
    'referral.share': 'Gabana Koodi',
    'referral.yourCode': 'Koodi yo ey\'okuyita',
    'loyalty.points': 'obupimo',
    'pay.title': 'Okusasula kwa NLSWMS',
    'pay.subtitle': 'Okusasula kwa mobile money okukuumiddwa',
    'pay.details': 'Ebikwata ku Nsasula',
    'pay.customer': 'Kasitoma',
    'pay.invoice': 'Invoyisi',
    'pay.description': 'Ennyinyonnyola',
    'pay.amount': 'Omuwendo',
    'pay.expires': 'Eggwaako',
    'pay.phoneLabel': 'Ennamba ya Mobile Money',
    'pay.phoneHint': 'Wandiika ennamba ya MTN MoMo oba Airtel Money.',
    'pay.payButton': 'Sasula',
    'pay.processing': 'Kikolebwa...',
    'pay.promptHint': 'Ojja kufuna obubaka ku ssimu yo okukakasa ensasula.',
    'pay.success': 'Ensasula Etuukiridde!',
    'pay.received': 'Ensasula yo eya',
    'pay.receivedSuffix': 'efunyiddwa.',
    'pay.receiptSent': 'Risiiti eweereddwa ku ssimu yo. Webale!',
    'pay.linkInvalid': 'Akakolo Tekakola',
  },
  sw: {
    'tabs.history': 'Historia ya Ukusanyaji',
    'tabs.invoices': 'Ankara',
    'tabs.payments': 'Malipo',
    'header.portal': 'Tovuti ya Mteja',
    'header.account': 'Akaunti',
    'stats.pickups': 'Ukusanyaji',
    'stats.pending': 'Inasubiri',
    'stats.dueInvoices': 'Ankara Zinazodaiwa',
    'stats.paid': 'Zilizolipwa',
    'cta.requestPickup': 'Omba Ukusanyaji wa Ziada',
    'servicePoints.title': 'Vituo Vyangu vya Huduma',
    'history.empty': 'Hakuna historia ya ukusanyaji bado.',
    'history.trackDriver': 'Fuatilia Dereva',
    'invoices.empty': 'Hakuna ankara bado.',
    'payments.totalPaid': 'Jumla iliyolipwa',
    'payments.statement': 'Taarifa',
    'payments.empty': 'Hakuna historia ya malipo bado.',
    'survey.rate': 'Kadiria ukusanyaji wako wa hivi karibuni',
    'survey.awaiting': 'utafiti unasubiri jibu lako',
    'impact.title': 'Athari Yangu',
    'impact.pickups': 'Ukusanyaji',
    'impact.kgDiverted': 'kg zilizookolewa',
    'impact.co2Saved': 'kg CO₂ zilizookolewa',
    'referral.title': 'Mwalike Rafiki',
    'referral.description': 'Shiriki msimbo wako — nyote wawili mnapata salio la pochi atakapolipa mara ya kwanza.',
    'referral.share': 'Shiriki Msimbo',
    'referral.yourCode': 'Msimbo wako wa mwaliko',
    'loyalty.points': 'pointi',
    'pay.title': 'Malipo ya NLSWMS',
    'pay.subtitle': 'Malipo salama ya pesa za simu',
    'pay.details': 'Maelezo ya Malipo',
    'pay.customer': 'Mteja',
    'pay.invoice': 'Ankara',
    'pay.description': 'Maelezo',
    'pay.amount': 'Kiasi',
    'pay.expires': 'Inaisha',
    'pay.phoneLabel': 'Namba ya Pesa za Simu',
    'pay.phoneHint': 'Weka namba ya MTN MoMo au Airtel Money.',
    'pay.payButton': 'Lipa',
    'pay.processing': 'Inashughulikiwa...',
    'pay.promptHint': 'Utapokea ujumbe wa MoMo kwenye simu yako kuthibitisha malipo.',
    'pay.success': 'Malipo Yamefanikiwa!',
    'pay.received': 'Malipo yako ya',
    'pay.receivedSuffix': 'yamepokelewa.',
    'pay.receiptSent': 'Risiti imetumwa kwenye simu yako. Asante!',
    'pay.linkInvalid': 'Kiungo Si Halali',
  },
};

export function resolveLanguage(customer) {
  try {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (stored && translations[stored]) return stored;
  } catch { /* localStorage unavailable */ }
  return PREFERRED_LANGUAGE_MAP[customer?.preferred_language] || 'en';
}

export function translate(lang, key) {
  return translations[lang]?.[key] ?? translations.en[key] ?? key;
}

export function useTranslation(customer) {
  const [lang, setLangState] = useState(() => resolveLanguage(customer));

  const setLang = useCallback((code) => {
    setLangState(code);
    try { localStorage.setItem(STORAGE_KEY, code); } catch { /* ignore */ }
  }, []);

  const t = useCallback((key) => translate(lang, key), [lang]);

  return { t, lang, setLang };
}
