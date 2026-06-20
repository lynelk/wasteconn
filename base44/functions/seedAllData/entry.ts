import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const TENANT_ID = '69e1364b1f13b6504df1acd0';
const FACILITY = { lat: 0.3267, lng: 32.6823, name: 'Namave Industrial Park, Mukono Road' };

const ZONES = {
  kla_central: '69df3b5fea4c84791cc4c6aa',
  kla_north:   '69df3b5fea4c84791cc4c6a9',
  wakiso:      '69df3b5fea4c84791cc4c6ab',
};

// ---- helpers ----
function rnd(a, b)        { return Math.floor(Math.random() * (b - a + 1)) + a; }
function rndF(a, b, dp=1) { return parseFloat((Math.random() * (b - a) + a).toFixed(dp)); }
function pick(arr)         { return arr[Math.floor(Math.random() * arr.length)]; }
function isoDate(d)        { return d.toISOString().split('T')[0]; }
function daysAgo(n)        { const d = new Date('2026-06-20T00:00:00Z'); d.setDate(d.getDate() - n); return d; }
function dateRange(startDa, endDa) {
  const s = daysAgo(startDa), e = daysAgo(endDa);
  return new Date(s.getTime() + Math.random() * (e.getTime() - s.getTime()));
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function chunks(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function safeBulk(entity, records, log) {
  let created = 0;
  for (const batch of chunks(records, 20)) {
    let attempts = 0;
    while (attempts < 5) {
      try {
        await entity.bulkCreate(batch);
        created += batch.length;
        break;
      } catch (e) {
        if (e.message?.includes('Rate limit') || e.message?.includes('429')) {
          attempts++;
          await sleep(2500 * attempts);
        } else { throw e; }
      }
    }
    await sleep(300);
  }
  return created;
}

// ---- data pools ----
const KAMPALA_LOCS = [
  { addr:'Nakasero Hill, Kampala',   lat:0.3190, lng:32.5795, zone:'kla_central' },
  { addr:'Kololo, Kampala',          lat:0.3310, lng:32.5921, zone:'kla_central' },
  { addr:'Bukoto, Kampala',          lat:0.3384, lng:32.5982, zone:'kla_north'   },
  { addr:'Ntinda, Kampala',          lat:0.3521, lng:32.6148, zone:'kla_north'   },
  { addr:'Kamwokya, Kampala',        lat:0.3421, lng:32.5881, zone:'kla_central' },
  { addr:'Mulago, Kampala',          lat:0.3461, lng:32.5762, zone:'kla_north'   },
  { addr:'Makerere, Kampala',        lat:0.3342, lng:32.5681, zone:'kla_north'   },
  { addr:'Wandegeya, Kampala',       lat:0.3289, lng:32.5714, zone:'kla_central' },
  { addr:'Lugogo, Kampala',          lat:0.3231, lng:32.6012, zone:'kla_central' },
  { addr:'Bugolobi, Kampala',        lat:0.3211, lng:32.6151, zone:'kla_central' },
  { addr:'Muyenga, Kampala',         lat:0.2831, lng:32.6012, zone:'kla_central' },
  { addr:'Kabalagala, Kampala',      lat:0.2910, lng:32.5919, zone:'kla_central' },
  { addr:'Kibuye, Kampala',          lat:0.2981, lng:32.5681, zone:'kla_central' },
  { addr:'Rubaga, Kampala',          lat:0.3052, lng:32.5592, zone:'kla_central' },
  { addr:'Mutungo, Kampala',         lat:0.3112, lng:32.6301, zone:'kla_central' },
  { addr:'Kyanja, Kampala',          lat:0.3721, lng:32.5941, zone:'kla_north'   },
  { addr:'Kiwatule, Kampala',        lat:0.3601, lng:32.6221, zone:'kla_north'   },
  { addr:'Kawempe, Kampala',         lat:0.3681, lng:32.5621, zone:'kla_north'   },
  { addr:'Katwe, Kampala',           lat:0.3011, lng:32.5751, zone:'kla_central' },
  { addr:'Namuwongo, Kampala',       lat:0.2991, lng:32.6081, zone:'kla_central' },
  { addr:'Bwaise, Kampala',          lat:0.3551, lng:32.5631, zone:'kla_north'   },
  { addr:'Mengo, Kampala',           lat:0.2981, lng:32.5611, zone:'kla_central' },
  { addr:'Namirembe, Kampala',       lat:0.3122, lng:32.5641, zone:'kla_central' },
  { addr:'Ndeeba, Kampala',          lat:0.2971, lng:32.5521, zone:'kla_central' },
  { addr:'Mpererwe, Kampala',        lat:0.3812, lng:32.5581, zone:'kla_north'   },
];
const WAKISO_LOCS = [
  { addr:'Nansana, Wakiso',      lat:0.3621, lng:32.5291, zone:'wakiso' },
  { addr:'Najjera, Wakiso',      lat:0.3712, lng:32.6121, zone:'wakiso' },
  { addr:'Kira, Wakiso',         lat:0.3841, lng:32.6341, zone:'wakiso' },
  { addr:'Namugongo, Wakiso',    lat:0.3921, lng:32.6521, zone:'wakiso' },
  { addr:'Entebbe, Wakiso',      lat:0.0621, lng:32.4621, zone:'wakiso' },
  { addr:'Kyaliwajjala, Wakiso', lat:0.3811, lng:32.6421, zone:'wakiso' },
];
const GULU_LOCS   = [
  { addr:'Pece Division, Gulu',   lat:2.7741, lng:32.2891, zone:null },
  { addr:'Layibi Division, Gulu', lat:2.7621, lng:32.2721, zone:null },
  { addr:'Laroo Division, Gulu',  lat:2.7812, lng:32.3041, zone:null },
  { addr:'Bardege, Gulu',         lat:2.7891, lng:32.2981, zone:null },
];
const MBARARA_LOCS = [
  { addr:'Kakoba Division, Mbarara',    lat:-0.6021, lng:30.6521, zone:null },
  { addr:'Kamukuzi Division, Mbarara',  lat:-0.6121, lng:30.6421, zone:null },
  { addr:'Nyamitanga Division, Mbarara',lat:-0.6221, lng:30.6321, zone:null },
];
const ARUA_LOCS  = [{ addr:'Ayivu Division, Arua', lat:3.0221, lng:30.9121, zone:null }, { addr:'Arua Hill, Arua', lat:3.0321, lng:30.9221, zone:null }];
const KABALE_LOCS = [{ addr:'Kabale Municipality', lat:-1.2521, lng:29.9871, zone:null }, { addr:'Rugarama, Kabale', lat:-1.2421, lng:29.9921, zone:null }];

const FIRST = ['Moses','Sarah','David','Grace','Robert','Mary','John','Alice','Peter','Ruth','Charles','Agnes','Samuel','Esther','Joseph','Irene','Emmanuel','Prossy','Francis','Josephine','Ronald','Patience','Andrew','Harriet','Michael','Betty','Daniel','Annet','Paul','Edith','George','Flavia','Patrick','Winnie','James','Beatrice','Richard','Jackline','Stephen','Lydia'];
const LAST  = ['Ssemakula','Nabwire','Okello','Namukasa','Kiggundu','Apio','Mugisha','Nabirye','Ouma','Nalukenge','Tumushabe','Atim','Mutebe','Akello','Sebuliba','Nakato','Byaruhanga','Nanteza','Kiiza','Kemigisha','Musoke','Namutebi','Wanyama','Nakiganda','Sentamu','Amoding','Kato','Nagawa','Lubega','Nankinga','Ssali','Oyella','Kavuma','Achola','Mwesigye','Nyakato','Nkurunziza','Atugonza','Rwabuhinga','Akena'];
const SME  = ['Ntinda Supermart','Bukoto Hardware','Wandegeya Pharmacy','Kololo Bakery','Kamwokya Quick Foods','Kabalagala Auto Spares','Katwe Metal Works','Kawempe General Store','Kyanja Fuel Station','Kiwatule Electronics','Mutungo Salon','Lugogo Car Wash','Muyenga Supermarket','Namirembe Clinic','Rubaga Print Centre','Nansana Hardware','Kira Pharmacy','Namugongo Bookshop','Entebbe Fresh Market','Pece Supermarket Gulu','Layibi General Store','Kakoba Pharmacy Mbarara','Ayivu Market Arua','Kabale Hardware Dealers'];
const INST = ['Makerere University','Mulago National Referral Hospital','Kampala International University','Uganda Christian University','St. Mary\'s College Kisubi','Nakasero Hospital','International Hospital Kampala','Aga Khan Medical Centre','Nile Breweries Nakamawa','Uganda Breweries Portbell','Roofings Group Namanve','Nice House of Plastics Namanve','Bidco Uganda Namanve','Crown Beverages Namanve','Uganda Clays Kajjansi','Victoria University','Serena Hotel Kampala','Sheraton Kampala Hotel','Gulu University','St. Joseph\'s Hospital Gulu','Mbarara University','Mbarara Regional Referral Hospital','Arua Regional Referral Hospital','Kabale University'];

const fn = () => `${pick(FIRST)} ${pick(LAST)}`;

const DRIVERS = ['DRV-001','DRV-002','DRV-003','DRV-004','DRV-005','DRV-006','DRV-007','DRV-008'];
const PLAN_PRICES = { res_basic:45000, res_std:65000, res_prem:95000, sme_std:145000, comm_plus:380000, inst_prem:680000, enterprise:1650000, university:2800000 };
const PLAN_IDS = {
  res_basic:'6a309c5aea19bff65690992f', res_std:'6a309c5aea19bff656909930', res_prem:'6a309c5aea19bff656909931',
  sme_std:'6a309c5aea19bff656909932', comm_plus:'6a309c5aea19bff656909933', inst_prem:'6a309c5aea19bff656909934',
  enterprise:'6a309c5aea19bff656909935', university:'6a309c5aea19bff656909936',
};

// -----------------------------------------------
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const logs = [];
    const log = (m) => { logs.push(m); console.log('[SEED] -', m); };

    // ---- STEP 1: CLEAR OLD DATA ----
    const CLEAR = [
      'Customer','Vehicle','PickupRequest','Payment','Invoice','Subscription','Complaint','Route',
      'Container','SensorReading','FuelLog','MaintenanceWorkOrder','CustomerSatisfaction','Ticket',
      'WasteBankTransaction','Inventory','ServicePoint','Contract','RouteFeedback','AuditLog',
      'Notification','FleetAlert','DriverLocation','ComplianceReport','ReportSnapshot',
      'SubcontractorJob','Subcontractor','RecyclerOffer','RecyclerBuyer','MaterialListing',
      'FacilityYieldRecord','OutboundShipment','MaintenanceAlert','CapacityPlan',
    ];
    for (const name of CLEAR) {
      try {
        let attempts = 0;
        while (attempts < 4) {
          try {
            const all = await base44.asServiceRole.entities[name].list('id', 200);
            if (!all.length) break;
            for (const r of all) await base44.asServiceRole.entities[name].delete(r.id);
            await sleep(200);
            break;
          } catch (e) {
            if (e.message?.includes('Rate limit') || e.message?.includes('429')) { attempts++; await sleep(3000 * attempts); }
            else break;
          }
        }
      } catch (e) { /* skip */ }
    }
    log('Old data cleared');
    await sleep(1500);

    // ---- STEP 2: ZONES ----
    await base44.asServiceRole.entities.ServiceZone.update(ZONES.kla_central, { tenant_id:TENANT_ID, zone_name:'Kampala Central Zone', region:'Central', district:'KAMPALA', county:'KAMPALA CENTRAL DIVISION', sub_county:'CENTRAL DIVISION', collection_days:['tuesday','friday'], collection_time:'07:00 - 10:00', status:'active', max_customers:200 });
    await base44.asServiceRole.entities.ServiceZone.update(ZONES.kla_north,   { tenant_id:TENANT_ID, zone_name:'Kampala North Zone',    region:'Central', district:'KAMPALA', county:'KAWEMPE DIVISION NORTH',   sub_county:'KAWEMPE DIVISION', collection_days:['monday','thursday'], collection_time:'07:00 - 10:00', status:'active', max_customers:150 });
    await base44.asServiceRole.entities.ServiceZone.update(ZONES.wakiso,      { tenant_id:TENANT_ID, zone_name:'Wakiso Metro Zone',     region:'Central', district:'WAKISO', county:'KYADONDO',                 sub_county:'NANSANA DIVISION', collection_days:['wednesday','saturday'], collection_time:'07:30 - 10:30', status:'active', max_customers:120 });
    const guluZ  = await base44.asServiceRole.entities.ServiceZone.create({ tenant_id:TENANT_ID, zone_name:'Gulu City Zone',   region:'Northern', district:'GULU',    county:'GULU MUNICIPAL COUNCIL',    sub_county:'LAROO DIVISION',   collection_days:['tuesday','saturday'], collection_time:'07:00 - 10:00', status:'active', max_customers:60 });
    const mbZ    = await base44.asServiceRole.entities.ServiceZone.create({ tenant_id:TENANT_ID, zone_name:'Mbarara City Zone', region:'Western',  district:'MBARARA', county:'MBARARA MUNICIPAL COUNCIL', sub_county:'KAKOBA DIVISION',  collection_days:['monday','thursday'],  collection_time:'07:30 - 10:00', status:'active', max_customers:45 });
    const aruaZ  = await base44.asServiceRole.entities.ServiceZone.create({ tenant_id:TENANT_ID, zone_name:'Arua City Zone',   region:'West Nile',district:'ARUA',    county:'ARUA MUNICIPALITY',          sub_county:'AYIVU DIVISION',   collection_days:['wednesday'],           collection_time:'08:00 - 11:00', status:'active', max_customers:30 });
    const kabZ   = await base44.asServiceRole.entities.ServiceZone.create({ tenant_id:TENANT_ID, zone_name:'Kabale Zone',      region:'Western',  district:'KABALE',  county:'KABALE MUNICIPALITY',        sub_county:'KABALE DIVISION',  collection_days:['friday'],              collection_time:'08:00 - 11:00', status:'active', max_customers:25 });
    const ZM = { kla_central:ZONES.kla_central, kla_north:ZONES.kla_north, wakiso:ZONES.wakiso, gulu:guluZ.id, mbarara:mbZ.id, arua:aruaZ.id, kabale:kabZ.id };
    log('Zones ready');

    // ---- STEP 3: VEHICLES ----
    const VEHICLE_DEFS = [
      { reg:'UAX 123K', type:'compactor', model:'Isuzu NPR',        yr:2021, cap:5, notes:'Kampala Central primary',              fuel:'diesel' },
      { reg:'UBG 456M', type:'tipper',    model:'Tata LPT 1613',    yr:2019, cap:4, notes:'Skip collection Lugogo & Industrial', fuel:'diesel' },
      { reg:'UAP 789J', type:'compactor', model:'Hino 500',          yr:2022, cap:7, notes:'Kampala North route',                 fuel:'diesel' },
      { reg:'UBC 321L', type:'flatbed',   model:'Mitsubishi Fuso',   yr:2020, cap:6, notes:'Brake service in progress',          fuel:'diesel', st:'maintenance' },
      { reg:'UBK 654N', type:'compactor', model:'Isuzu FRR',         yr:2023, cap:5, notes:'Gulu City operations',               fuel:'diesel' },
      { reg:'UAV 987G', type:'tipper',    model:'Tata 407',          yr:2018, cap:3, notes:'Mbarara operations',                 fuel:'diesel' },
      { reg:'UBA 159P', type:'compactor', model:'Hino 300',          yr:2021, cap:5, notes:'Upcountry routes',                   fuel:'diesel' },
      { reg:'UBN 222Q', type:'tipper',    model:'Isuzu ELF',         yr:2022, cap:4, notes:'Wakiso Metro zone',                  fuel:'diesel' },
    ];
    const vehRecs = [];
    for (const v of VEHICLE_DEFS) {
      const ls = daysAgo(rnd(30,180));
      const ns = new Date(ls); ns.setDate(ns.getDate() + 90);
      const r = await base44.asServiceRole.entities.Vehicle.create({
        tenant_id:TENANT_ID, registration_number:v.reg, vehicle_type:v.type, make_model:v.model,
        year:v.yr, capacity_tonnes:v.cap, fuel_type:v.fuel, status:v.st || 'active',
        last_service_date:isoDate(ls), next_service_date:isoDate(ns), notes:v.notes,
      });
      vehRecs.push({ ...v, dbId:r.id });
    }
    log(`Created ${vehRecs.length} vehicles`);
    await sleep(500);

    // ---- STEP 4: CUSTOMER DEFINITIONS (200 total) ----
    function zoneFor(loc, dist) {
      if (dist === 'GULU')    return ZM.gulu;
      if (dist === 'MBARARA') return ZM.mbarara;
      if (dist === 'ARUA')    return ZM.arua;
      if (dist === 'KABALE')  return ZM.kabale;
      if (dist === 'WAKISO')  return ZM.wakiso;
      return loc.zone ? ZM[loc.zone] : ZM.kla_central;
    }

    const custDefs = [];
    let acc = 1001;

    function pushCust(type, seg, tier, locPool, planKey, dist, qty) {
      for (let i = 0; i < qty; i++) {
        const loc  = pick(locPool);
        const jit  = { lat: loc.lat + rndF(-0.002,0.002,4), lng: loc.lng + rndF(-0.002,0.002,4) };
        const momoP = pick(['mtn','mtn','airtel','none']);
        const phone = `+2567${rnd(10,99)}${rnd(100000,999999)}`;
        const name  = seg === 'institution' ? pick(INST) : seg === 'sme' ? pick(SME) : fn();
        const onboardedDaysAgo = rnd(30, 730); // spread across 2 years
        custDefs.push({ type, seg, tier, loc, jit, planKey, dist, momoP, phone, name, onboardedDaysAgo,
          acct:`ACC-${acc++}`, zone:zoneFor(loc, dist),
          status: Math.random() > 0.07 ? 'active' : (Math.random() > 0.5 ? 'inactive' : 'suspended'),
        });
      }
    }

    // Kampala ~158
    pushCust('residential', 'individual',  'basic',      KAMPALA_LOCS, 'res_basic',   'KAMPALA', 62);
    pushCust('residential', 'individual',  'standard',   KAMPALA_LOCS, 'res_std',     'KAMPALA', 32);
    pushCust('residential', 'individual',  'premium',    KAMPALA_LOCS, 'res_prem',    'KAMPALA', 14);
    pushCust('commercial',  'sme',         'standard',   KAMPALA_LOCS, 'sme_std',     'KAMPALA', 20);
    pushCust('commercial',  'sme',         'standard',   KAMPALA_LOCS, 'comm_plus',   'KAMPALA', 12);
    pushCust('commercial',  'institution', 'premium',    KAMPALA_LOCS, 'inst_prem',   'KAMPALA', 9);
    pushCust('industrial',  'institution', 'enterprise', KAMPALA_LOCS, 'enterprise',  'KAMPALA', 5);
    pushCust('commercial',  'institution', 'enterprise', KAMPALA_LOCS, 'university',  'KAMPALA', 4);
    // Wakiso ~18
    pushCust('residential', 'individual',  'basic',      WAKISO_LOCS,  'res_basic',   'WAKISO',  10);
    pushCust('commercial',  'sme',         'standard',   WAKISO_LOCS,  'sme_std',     'WAKISO',  5);
    pushCust('commercial',  'institution', 'premium',    WAKISO_LOCS,  'inst_prem',   'WAKISO',  3);
    // Gulu ~12
    pushCust('residential', 'individual',  'basic',      GULU_LOCS,    'res_basic',   'GULU',    6);
    pushCust('commercial',  'sme',         'standard',   GULU_LOCS,    'sme_std',     'GULU',    4);
    pushCust('commercial',  'institution', 'premium',    GULU_LOCS,    'inst_prem',   'GULU',    2);
    // Mbarara ~7
    pushCust('residential', 'individual',  'basic',      MBARARA_LOCS, 'res_std',     'MBARARA', 4);
    pushCust('commercial',  'sme',         'standard',   MBARARA_LOCS, 'comm_plus',   'MBARARA', 2);
    pushCust('commercial',  'institution', 'premium',    MBARARA_LOCS, 'inst_prem',   'MBARARA', 1);
    // Arua ~5
    pushCust('residential', 'individual',  'basic',      ARUA_LOCS,    'res_basic',   'ARUA',    3);
    pushCust('commercial',  'sme',         'standard',   ARUA_LOCS,    'sme_std',     'ARUA',    2);
    // Kabale ~5
    pushCust('residential', 'individual',  'basic',      KABALE_LOCS,  'res_basic',   'KABALE',  3);
    pushCust('commercial',  'sme',         'standard',   KABALE_LOCS,  'sme_std',     'KABALE',  2);

    log(`Defined ${custDefs.length} customers`);

    const custBatch = custDefs.map(c => ({
      tenant_id: TENANT_ID,
      full_name: c.name,
      phone: c.phone,
      email: c.seg !== 'individual'
        ? `admin@${c.name.toLowerCase().replace(/[^a-z]/g,'-').replace(/-+/g,'-').slice(0,18)}.ug`
        : `${c.name.toLowerCase().replace(/\s/g,'.')}@gmail.com`,
      customer_type: c.type,
      customer_segment: c.seg,
      customer_tier: c.tier,
      account_number: c.acct,
      address: c.loc.addr,
      latitude: c.jit.lat,
      longitude: c.jit.lng,
      district: c.dist,
      zone_id: c.zone,
      status: c.status,
      mobile_money_provider: c.momoP,
      mobile_money_number: c.momoP !== 'none' ? c.phone : null,
      preferred_language: c.dist === 'KAMPALA' ? pick(['english','luganda','english']) : 'english',
      bin_count: c.seg === 'institution' ? rnd(3,12) : c.seg === 'sme' ? rnd(2,5) : rnd(1,3),
      estimated_waste_kg_month: c.type === 'industrial' ? rnd(2000,12000) : c.type === 'commercial' ? rnd(150,2000) : rnd(20,110),
      onboarding_source: pick(['manual','bulk_import','self_service','referral']),
      churn_risk_score: rnd(0,85),
      institution_name: c.seg === 'institution' ? c.name : null,
      contact_person: c.seg !== 'individual' ? fn() : null,
      num_branches: c.seg === 'institution' ? rnd(1,4) : 1,
      tier_auto_classified: Math.random() > 0.5,
    }));

    const createdCustomers = [];
    for (const batch of chunks(custBatch, 20)) {
      let att = 0;
      while (att < 5) {
        try {
          const res = await base44.asServiceRole.entities.Customer.bulkCreate(batch);
          if (Array.isArray(res)) createdCustomers.push(...res);
          break;
        } catch (e) {
          if (e.message?.includes('Rate limit') || e.message?.includes('429')) { att++; await sleep(2500 * att); }
          else throw e;
        }
      }
      await sleep(400);
    }
    log(`Created ${createdCustomers.length} customers`);
    await sleep(800);

    for (let i = 0; i < custDefs.length && i < createdCustomers.length; i++) {
      custDefs[i].id = createdCustomers[i]?.id || createdCustomers[i]?._id;
    }
    const validCusts = custDefs.filter(c => c.id);

    // ---- STEP 5: SUBSCRIPTIONS ----
    const subBatch = validCusts.map(c => {
      const startDate = dateRange(720, 30);
      const price     = PLAN_PRICES[c.planKey];
      const payMethod = c.momoP === 'mtn' ? 'mtn_momo' : c.momoP === 'airtel' ? 'airtel_money' : pick(['cash','bank_transfer']);
      const freq      = ['res_basic','res_std'].includes(c.planKey) ? 'weekly' : ['res_prem','sme_std'].includes(c.planKey) ? 'twice_weekly' : 'daily';
      return {
        tenant_id:TENANT_ID, customer_id:c.id, plan_id:PLAN_IDS[c.planKey],
        zone_id:c.zone, billing_model:'postpaid',
        status: c.status === 'active' ? 'active' : 'cancelled',
        start_date: isoDate(startDate),
        contract_duration_months: ['enterprise','university','inst_prem'].includes(c.planKey) ? 12 : 3,
        auto_renew:true, next_billing_date:isoDate(daysAgo(-14)),
        amount_ugx:price, discount_pct: Math.random() < 0.1 ? rnd(5,20) : 0,
        payment_method:payMethod, service_frequency:freq,
        collection_days:['monday','thursday'],
        contract_signed:true, contract_signed_date:isoDate(startDate),
        contract_version:1, amendment_history:[], renewal_reminder_sent:false,
      };
    });
    const subCount = await safeBulk(base44.asServiceRole.entities.Subscription, subBatch, log);
    log(`Created ${subCount} subscriptions`);
    await sleep(800);

    // ---- STEP 6: INVOICES & PAYMENTS (2 years) ----
    const invoiceBatch = [];
    const paymentBatch = [];
    let invSeq = 1001;
    for (const c of validCusts.slice(0, validCusts.length)) {
      const price  = PLAN_PRICES[c.planKey];
      const months = rnd(18, 24);
      for (let m = months; m >= 1; m--) {
        const issDate = daysAgo(m * 30);
        const dueDate = new Date(issDate); dueDate.setDate(dueDate.getDate() + 30);
        const isPaid  = m > 2 || Math.random() > 0.3;
        const paidDate = isPaid ? new Date(issDate.getTime() + rnd(2,25)*86400000) : null;
        invoiceBatch.push({
          tenant_id:TENANT_ID, customer_id:c.id,
          invoice_number:`INV-${issDate.getFullYear()}-${String(invSeq++).padStart(4,'0')}`,
          amount_ugx:price,
          status: isPaid ? 'paid' : m === 1 ? 'issued' : 'overdue',
          issue_date:isoDate(issDate), due_date:isoDate(dueDate),
          paid_date: paidDate ? paidDate.toISOString() : null,
          items:[{ description:`${c.planKey.replace('_',' ')} - ${issDate.toLocaleString('en',{month:'short',year:'numeric'})}`, quantity:1, unit_price_ugx:price, total_ugx:price }],
        });
        if (isPaid) {
          const pm = c.momoP === 'mtn' ? 'mtn_momo' : c.momoP === 'airtel' ? 'airtel_money' : pick(['cash','bank_transfer']);
          paymentBatch.push({
            tenant_id:TENANT_ID, customer_id:c.id, amount_ugx:price,
            payment_method:pm, status:'completed', payment_date:isoDate(paidDate),
            transaction_ref:`TXN-${rnd(100000,999999)}`,
            mobile_money_number: c.momoP !== 'none' ? c.phone : null,
            period_from:isoDate(issDate), period_to:isoDate(dueDate), recorded_by:'System',
          });
        }
      }
    }
    const invCount = await safeBulk(base44.asServiceRole.entities.Invoice, invoiceBatch, log);
    log(`Created ${invCount} invoices`);
    await sleep(500);
    const payCount = await safeBulk(base44.asServiceRole.entities.Payment, paymentBatch, log);
    log(`Created ${payCount} payments`);
    await sleep(800);

    // ---- STEP 7: PICKUP REQUESTS ----
    const pickupBatch = [];
    const activeVehs = vehRecs.filter(v => v.st !== 'maintenance');
    for (const c of validCusts) {
      const n = c.seg === 'institution' ? rnd(20,40) : c.seg === 'sme' ? rnd(12,24) : rnd(8,16);
      for (let i = 0; i < n; i++) {
        const pd      = dateRange(730, 1);
        const st      = Math.random() < 0.85 ? 'completed' : Math.random() < 0.7 ? 'cancelled' : 'pending';
        const veh     = pick(activeVehs);
        const drv     = pick(DRIVERS);
        const dur     = rnd(25,140);
        const started = new Date(pd); started.setHours(rnd(6,9), rnd(0,45));
        const completed = new Date(started.getTime() + dur * 60000);
        const wt = c.type === 'industrial' ? rnd(500,7000) : c.type === 'commercial' ? rnd(50,700) : rnd(10,75);
        pickupBatch.push({
          tenant_id:TENANT_ID, customer_id:c.id, zone_id:c.zone,
          request_type:'scheduled', status:st,
          scheduled_date:isoDate(pd), scheduled_time:`0${rnd(6,9)}:00`,
          assigned_driver_id:drv, assigned_vehicle_id:veh.dbId,
          waste_type:pick(['general','general','recyclable','organic']),
          actual_weight_kg: st === 'completed' ? wt : null,
          address:c.loc.addr, latitude:c.jit.lat, longitude:c.jit.lng,
          job_started_at:  st === 'completed' ? started.toISOString() : null,
          completed_at:    st === 'completed' ? completed.toISOString() : null,
          actual_duration_mins:  st === 'completed' ? dur : null,
          route_distance_km:     st === 'completed' ? rndF(3,30,1) : null,
          source:'internal', service_category:'standard',
          billing_status: st === 'completed' ? 'invoiced' : 'none',
          sla_breach_flagged: Math.random() < 0.04,
          driver_route_feedback: st === 'completed' ? pick(['preferred','neutral','suboptimal']) : null,
          photo_urls: st === 'completed' ? [`https://storage.example.com/p${rnd(1000,9999)}.jpg`] : [],
          evidence_quality_score: st === 'completed' ? rnd(65,100) : null,
          cv_bin_present: st === 'completed' ? Math.random() > 0.08 : null,
          cv_flagged_for_review: Math.random() < 0.03,
        });
      }
    }
    const pickupCount = await safeBulk(base44.asServiceRole.entities.PickupRequest, pickupBatch, log);
    log(`Created ${pickupCount} pickup requests`);
    await sleep(800);

    // ---- STEP 8: ROUTES ----
    const routeZones = [
      { name:'Central Kampala Morning',     zone:ZM.kla_central, drv:'DRV-001', veh:vehRecs[0].dbId },
      { name:'Central Kampala Commercial',  zone:ZM.kla_central, drv:'DRV-002', veh:vehRecs[1].dbId },
      { name:'Kampala North Residential',   zone:ZM.kla_north,   drv:'DRV-003', veh:vehRecs[2].dbId },
      { name:'Wakiso Metro',                zone:ZM.wakiso,      drv:'DRV-007', veh:vehRecs[7].dbId },
      { name:'Gulu City',                   zone:ZM.gulu,        drv:'DRV-005', veh:vehRecs[4].dbId },
      { name:'Mbarara City',                zone:ZM.mbarara,     drv:'DRV-006', veh:vehRecs[5].dbId },
    ];
    const routeBatch = [];
    for (let db = 730; db >= 0; db -= 2) {
      const rt      = pick(routeZones);
      const rDate   = daysAgo(db);
      const estDist = rndF(12,35,1);
      const estDur  = rnd(90,210);
      const done    = db > 0;
      const actDist = done ? rndF(estDist*0.85, estDist*1.2, 1) : null;
      const actDur  = done ? rnd(estDur-30, estDur+60) : null;
      const started = done ? new Date(new Date(rDate).setHours(6, rnd(0,30))) : null;
      const completedR = done && actDur ? new Date(started.getTime() + actDur*60000) : null;
      routeBatch.push({
        tenant_id:TENANT_ID, zone_id:rt.zone, vehicle_id:rt.veh, driver_id:rt.drv,
        route_date:isoDate(rDate), route_name:`${rt.name} - ${isoDate(rDate)}`,
        status: db === 0 ? 'published' : db < 3 ? 'in_progress' : 'completed',
        estimated_distance_km:estDist, estimated_duration_mins:estDur,
        actual_distance_km:actDist, actual_duration_mins:actDur,
        started_at: started?.toISOString() || null,
        completed_at: completedR?.toISOString() || null,
        fuel_cost_ugx: done ? rnd(45000,180000) : null,
        ai_optimised: Math.random() > 0.45,
        ai_optimisation_notes: Math.random() > 0.5 ? `Route optimised to avoid congestion. Terminal drop-off: ${FACILITY.name}` : null,
        path_input_method: pick(['drawn','manual','imported']),
        notes:`Waste transported to ${FACILITY.name}`,
      });
    }
    const routeCount = await safeBulk(base44.asServiceRole.entities.Route, routeBatch, log);
    log(`Created ${routeCount} routes`);
    await sleep(800);

    // ---- STEP 9: CONTAINERS ----
    const binLocs = [...KAMPALA_LOCS, ...WAKISO_LOCS, ...GULU_LOCS.slice(0,2)];
    const containerBatch = [];
    for (let i = 0; i < 40; i++) {
      const loc    = pick(binLocs);
      const isSkip = Math.random() < 0.2;
      const fill   = rnd(5,99);
      containerBatch.push({
        tenant_id:TENANT_ID,
        label:`${loc.addr.split(',')[0]} Bin ${i+1}`,
        qr_code:`QR-BIN-${String(i+1).padStart(3,'0')}`,
        asset_category: isSkip ? 'skip' : 'smart_bin',
        fill_logic_type: isSkip ? 'weight' : 'volume',
        zone_id: loc.zone ? ZM[loc.zone] : ZM.kla_central,
        waste_stream: pick(['general','general','recyclable','organic']),
        status: Math.random() > 0.08 ? 'active' : 'maintenance',
        latitude: loc.lat + rndF(-0.001,0.001,4),
        longitude: loc.lng + rndF(-0.001,0.001,4),
        address: loc.addr,
        capacity_litres: isSkip ? null : pick([120,240,360]),
        max_weight_kg: isSkip ? pick([1000,2000,3000]) : null,
        collection_threshold_pct: rnd(75,90),
        last_fill_pct: fill,
        last_battery_pct: isSkip ? null : rnd(20,100),
        last_weight_kg: isSkip ? rnd(200,2800) : null,
        last_reading_at: daysAgo(rnd(0,2)).toISOString(),
        avg_daily_fill_rate_pct: isSkip ? null : rndF(3,22,1),
        avg_daily_weight_gain_kg: isSkip ? rndF(50,400,1) : null,
        sensor_id:`SNS-${String(i+1).padStart(3,'0')}`,
        firmware_version: pick(['v2.3.1','v2.3.2','v2.4.0','v1.8.0']),
      });
    }
    const containerIds = [];
    for (const batch of chunks(containerBatch, 20)) {
      let att = 0;
      while (att < 5) {
        try {
          const res = await base44.asServiceRole.entities.Container.bulkCreate(batch);
          if (Array.isArray(res)) containerIds.push(...res.map(r => r.id || r._id));
          break;
        } catch (e) {
          if (e.message?.includes('Rate limit') || e.message?.includes('429')) { att++; await sleep(2500*att); }
          else throw e;
        }
      }
      await sleep(300);
    }
    log(`Created ${containerIds.length} containers`);
    await sleep(500);

    // ---- STEP 10: SENSOR READINGS ----
    const sensorBatch = [];
    for (const cid of containerIds.slice(0,12)) {
      let fill = rnd(10,40);
      for (let h = 60*24; h >= 0; h -= 6) {
        fill = Math.min(100, fill + rndF(0,3,1));
        if (fill > 85) fill = rnd(5,15);
        sensorBatch.push({ tenant_id:TENANT_ID, container_id:cid, sensor_id:'SNS-AUTO', fill_level_pct:fill, distance_cm:Math.round((1-fill/100)*120), battery_pct:rnd(25,100), temperature_c:rndF(22,35,1), tilt_detected:false, fire_detected:false, measured_at:daysAgo(h/24).toISOString(), source:'ultrasonic' });
      }
    }
    const sensorCount = await safeBulk(base44.asServiceRole.entities.SensorReading, sensorBatch, log);
    log(`Created ${sensorCount} sensor readings`);
    await sleep(500);

    // ---- STEP 11: FUEL LOGS ----
    const fuelBatch = [];
    for (const v of vehRecs) {
      for (let m = 24; m >= 1; m--) {
        const fd = daysAgo(m * 30 + rnd(0,15));
        fuelBatch.push({
          tenant_id:TENANT_ID, vehicle_id:v.dbId, driver_id:pick(DRIVERS),
          fuel_date:isoDate(fd), litres:rndF(40,120,1), cost_ugx:rnd(180000,600000),
          odometer_km: 50000 + (24-m)*rnd(800,1800), fuel_type:'diesel',
          station_name: pick(['Total Energies Kampala Rd','Shell Jinja Rd','Vivo Nakawa','Total Entebbe Rd','Shell Gulu Main']),
          efficiency_km_per_litre: rndF(4.5,9.5,2),
        });
      }
    }
    const fuelCount = await safeBulk(base44.asServiceRole.entities.FuelLog, fuelBatch, log);
    log(`Created ${fuelCount} fuel logs`);
    await sleep(500);

    // ---- STEP 12: MAINTENANCE WORK ORDERS ----
    const mwTitles = ['Oil & Filter Change','Brake Pad Replacement','Tyre Rotation & Alignment','Hydraulic System Check','Compactor Blade Service','Engine Tune-Up','Air Filter Replacement','Battery Replacement','Transmission Service','Suspension Overhaul'];
    const mwBatch  = [];
    for (const v of vehRecs) {
      for (let i = 0; i < rnd(6,14); i++) {
        const od   = dateRange(720,10);
        const done = Math.random() > 0.2;
        mwBatch.push({
          tenant_id:TENANT_ID, vehicle_id:v.dbId, title:pick(mwTitles),
          order_type: pick(['preventive','corrective','corrective','predictive']),
          status: done ? 'completed' : pick(['open','in_progress']),
          priority: pick(['low','medium','high','critical']),
          description:`Service on ${v.model}. Returned to ${FACILITY.name} depot.`,
          scheduled_date:isoDate(od),
          completed_date: done ? isoDate(new Date(od.getTime() + rnd(1,5)*86400000)) : null,
          assigned_technician: pick(['Ssemakula Brian','Okello Denis','Kato Ivan','Mwesigye Paul']),
          cost_ugx: done ? rnd(80000,2800000) : null,
          parts_used: done ? pick(['Brake pads x4','Engine oil 15L + filter','Air & fuel filter','Tyres x2','Hydraulic fluid 10L']) : null,
          ai_prediction_score: rndF(10,85,0),
        });
      }
    }
    const mwCount = await safeBulk(base44.asServiceRole.entities.MaintenanceWorkOrder, mwBatch, log);
    log(`Created ${mwCount} maintenance work orders`);
    await sleep(500);

    // ---- STEP 13: MAINTENANCE ALERTS ----
    const alertTypes = ['service_due','fault_code','excessive_idle','harsh_driving','low_fuel'];
    const maintAlertBatch = [];
    for (const v of vehRecs) {
      const numAlerts = rnd(3,8);
      for (let i = 0; i < numAlerts; i++) {
        const atype = pick(alertTypes);
        const resolved = Math.random() > 0.4;
        const alertDate = dateRange(720,1);
        maintAlertBatch.push({
          tenant_id:TENANT_ID, vehicle_id:v.dbId, alert_type:atype,
          severity: atype === 'fault_code' ? 'critical' : pick(['info','warning','warning','critical']),
          fault_code: atype === 'fault_code' ? `P${rnd(1000,2999)}` : null,
          description:`${atype.replace(/_/g,' ')} detected on vehicle ${v.reg}. Inspection recommended.`,
          predicted_service_date: isoDate(new Date(alertDate.getTime() + rnd(7,30)*86400000)),
          ai_recommended_action: pick(['Schedule service within 7 days','Inspect brake system','Check engine oil level','Reduce idle time','Refuel at next depot stop']),
          status: resolved ? 'resolved' : pick(['open','scheduled']),
          resolved_at: resolved ? new Date(alertDate.getTime() + rnd(1,10)*86400000).toISOString() : null,
        });
      }
    }
    const maintAlertCount = await safeBulk(base44.asServiceRole.entities.MaintenanceAlert, maintAlertBatch, log);
    log(`Created ${maintAlertCount} maintenance alerts`);
    await sleep(500);

    // ---- STEP 14: COMPLAINTS ----
    const compCats = ['missed_collection','billing','driver_behaviour','overflowing_bin','illegal_dumping','damaged_bin','service_quality','other'];
    const compBatch = [];
    for (let i = 0; i < 200; i++) {
      const c   = pick(validCusts);
      const cat = pick(compCats);
      const cd  = dateRange(720,0);
      const res = Math.random() > 0.35;
      compBatch.push({
        tenant_id:TENANT_ID, customer_id:c.id, category:cat,
        subject:`${cat.replace(/_/g,' ')} - ${c.loc.addr.split(',')[0]}`,
        description:`Customer reports ${cat.replace(/_/g,' ')} at ${c.loc.addr}. Requires urgent attention.`,
        status: res ? pick(['resolved','closed']) : pick(['open','in_review']),
        priority: pick(['low','medium','high','urgent']),
        source: pick(['customer_app','email','phone','public_report','in_app']),
        latitude:c.jit.lat, longitude:c.jit.lng,
        resolved_at: res ? new Date(cd.getTime() + rnd(1,5)*86400000).toISOString() : null,
        resolution_notes: res ? 'Issue investigated and resolved. Driver coached.' : null,
        ai_sentiment:'negative', ai_escalate: Math.random() < 0.15,
        ai_estimated_resolution_hours: pick([4,8,12,24,48]),
        rating: res ? rnd(1,5) : null,
      });
    }
    const compCount = await safeBulk(base44.asServiceRole.entities.Complaint, compBatch, log);
    log(`Created ${compCount} complaints`);
    await sleep(500);

    // ---- STEP 15: TICKETS ----
    const tktCats = ['missed_collection','billing_dispute','service_quality','access_issue','bin_damage','driver_behaviour','general_inquiry'];
    const tktBatch = [];
    for (let i = 0; i < 150; i++) {
      const c   = pick(validCusts);
      const cat = pick(tktCats);
      const td  = dateRange(720,0);
      const res = Math.random() > 0.3;
      const sla = rnd(12,72);
      tktBatch.push({
        tenant_id:TENANT_ID, customer_id:c.id,
        ticket_number:`TKT-${String(2000+i).padStart(5,'0')}`, category:cat,
        subject:`${cat.replace(/_/g,' ')} - ${c.loc.addr.split(',')[0]}`,
        description:`Customer reports ${cat.replace(/_/g,' ')} issue. Requires investigation.`,
        status: res ? pick(['resolved','closed']) : pick(['open','triaged','assigned','in_progress']),
        priority: pick(['low','medium','high','urgent']),
        source: pick(['in_app','email','phone','whatsapp','web_form']),
        zone_id:c.zone, sla_hours:sla,
        sla_due_at: new Date(td.getTime() + sla*3600000).toISOString(),
        sla_breached: !res && Math.random() < 0.18,
        resolved_at: res ? new Date(td.getTime() + rnd(2,48)*3600000).toISOString() : null,
        resolution_notes: res ? 'Investigated and resolved. Customer notified.' : null,
        ai_category:cat, ai_priority:pick(['low','medium','high']),
        ai_sentiment:'negative', closure_verified: res && Math.random() > 0.5,
      });
    }
    const tktCount = await safeBulk(base44.asServiceRole.entities.Ticket, tktBatch, log);
    log(`Created ${tktCount} tickets`);
    await sleep(500);

    // ---- STEP 16: SATISFACTION SURVEYS ----
    const surveyBatch = [];
    for (const c of validCusts.slice(0,140)) {
      const n = rnd(1,5);
      for (let i = 0; i < n; i++) {
        const rating = rnd(1,5);
        surveyBatch.push({
          tenant_id:TENANT_ID, customer_id:c.id, zone_id:c.zone, driver_id:pick(DRIVERS), rating,
          comment: rating >= 4 ? pick(['Excellent service!','Very professional','On time, great work']) : rating === 3 ? 'Service was okay' : pick(['Driver was late','Bin not fully emptied','Poor service']),
          channel: pick(['in_app','sms','email']),
          responded_at: dateRange(720,0).toISOString(),
          ai_sentiment: rating >= 4 ? 'positive' : rating === 3 ? 'neutral' : 'negative',
          ai_pain_points: rating < 3 ? [pick(['punctuality','driver_behaviour','incomplete_collection'])] : [],
          surveyed:true,
        });
      }
    }
    const surveyCount = await safeBulk(base44.asServiceRole.entities.CustomerSatisfaction, surveyBatch, log);
    log(`Created ${surveyCount} satisfaction surveys`);
    await sleep(500);

    // ---- STEP 17: WASTE BANK TRANSACTIONS ----
    const wbCats  = ['plastic','paper','glass','metal','organic','mixed'];
    const wbRates = [500,800,1200,1500,600,300];
    const wbBatch = [];
    for (let i = 0; i < 280; i++) {
      const c    = pick(validCusts.filter(x => x.type !== 'industrial'));
      const wt   = rndF(0.5,50,1);
      const rate = pick(wbRates);
      const gross = Math.round(wt * rate);
      const ded   = Math.round(gross * rndF(0,0.08,2));
      wbBatch.push({
        tenant_id:TENANT_ID, customer_id:c.id,
        transaction_number:`WBT-${String(3000+i).padStart(5,'0')}`,
        transaction_type:'payout', zone_id:c.zone,
        waste_category:pick(wbCats), grade:pick(['A','A','B','B','C']),
        weight_kg:wt, rate_ugx_per_kg:rate, gross_amount_ugx:gross,
        deductions_ugx:ded, net_amount_ugx:gross-ded,
        payment_method: c.momoP === 'mtn' ? 'mtn_momo' : c.momoP === 'airtel' ? 'airtel_money' : 'cash',
        mobile_money_number: c.momoP !== 'none' ? c.phone : null,
        payment_status:'completed', payment_reference:`WB-${rnd(100000,999999)}`,
        gps_lat:c.jit.lat, gps_lon:c.jit.lng, fraud_flag:false,
        ai_grade_suggestion:pick(['A','B','B']),
      });
    }
    const wbCount = await safeBulk(base44.asServiceRole.entities.WasteBankTransaction, wbBatch, log);
    log(`Created ${wbCount} waste bank transactions`);
    await sleep(500);

    // ---- STEP 18: INVENTORY ----
    const invItems = [
      { item_name:'High-Density Waste Bags 120L',  category:'bags',        unit:'boxes', stock:rnd(20,80),  threshold:10, reorder:50, cost:rnd(45000,80000)   },
      { item_name:'Safety Gloves (Heavy Duty)',     category:'safety_gear', unit:'units', stock:rnd(30,100), threshold:20, reorder:80, cost:rnd(8000,15000)    },
      { item_name:'Hi-Vis Safety Vests',            category:'ppe',         unit:'units', stock:rnd(10,30),  threshold:8,  reorder:30, cost:rnd(12000,25000)   },
      { item_name:'Diesel Fuel Cans 20L',           category:'fuel_cans',   unit:'units', stock:rnd(5,20),   threshold:5,  reorder:20, cost:rnd(180000,250000) },
      { item_name:'Safety Boots Size 42-45',        category:'ppe',         unit:'units', stock:rnd(5,15),   threshold:4,  reorder:12, cost:rnd(55000,90000)   },
      { item_name:'Hydraulic Oil 20L',              category:'tools',       unit:'units', stock:rnd(4,12),   threshold:3,  reorder:10, cost:rnd(120000,200000) },
      { item_name:'Compactor Blade Set',            category:'tools',       unit:'units', stock:rnd(2,6),    threshold:2,  reorder:4,  cost:rnd(450000,800000) },
      { item_name:'Engine Oil 15W40 5L',            category:'tools',       unit:'units', stock:rnd(8,25),   threshold:5,  reorder:20, cost:rnd(65000,95000)   },
      { item_name:'Face Masks Box of 50',           category:'ppe',         unit:'boxes', stock:rnd(10,40),  threshold:6,  reorder:30, cost:rnd(25000,40000)   },
      { item_name:'Tyre Repair Kit',                category:'tools',       unit:'units', stock:rnd(3,8),    threshold:2,  reorder:6,  cost:rnd(80000,150000)  },
      { item_name:'Warning Cones Traffic',          category:'safety_gear', unit:'units', stock:rnd(8,20),   threshold:6,  reorder:20, cost:rnd(15000,30000)   },
      { item_name:'First Aid Kit',                  category:'other',       unit:'units', stock:rnd(3,8),    threshold:2,  reorder:5,  cost:rnd(45000,80000)   },
    ];
    const invBatch = invItems.map(item => ({
      tenant_id:TENANT_ID, item_name:item.item_name, category:item.category,
      sku:`SKU-${rnd(10000,99999)}`, current_stock:item.stock, unit_of_measure:item.unit,
      safety_threshold:item.threshold, reorder_quantity:item.reorder, unit_cost_ugx:item.cost,
      supplier_name: pick(['Kampala Hardware Ltd','Crane Supplies','Total Uganda','Quality Spares KLA','Industrial Supplies UG']),
      location:'Namave Industrial Park Warehouse', last_restocked_date:isoDate(daysAgo(rnd(7,60))),
      po_status: item.stock <= item.threshold ? 'pending' : 'none',
    }));
    await safeBulk(base44.asServiceRole.entities.Inventory, invBatch, log);
    log(`Created ${invBatch.length} inventory items`);

    // ---- STEP 19: SERVICE POINTS ----
    const spBatch = validCusts.filter(c => c.seg === 'institution').slice(0,30).map(c => ({
      tenant_id:TENANT_ID, customer_id:c.id, zone_id:c.zone,
      name:`${c.loc.addr.split(',')[0]} Service Point`,
      address:c.loc.addr, latitude:c.jit.lat, longitude:c.jit.lng, status:'active',
      collection_days:['monday','wednesday','friday'], collection_time:'07:00 - 09:00',
      bin_count:rnd(2,8), waste_streams:['general','recyclable'],
    }));
    await safeBulk(base44.asServiceRole.entities.ServicePoint, spBatch, log);
    log(`Created ${spBatch.length} service points`);
    await sleep(500);

    // ---- STEP 20: SUBCONTRACTORS ----
    const subcontractorDefs = [
      { company:'Ssemakula Transport Ltd',     contact:fn(), phone:'+256772100001', email:'ops@ssemakula.co.ug', vehicles:4, zones:[ZM.kla_central,ZM.kla_north] },
      { company:'Greenfield Waste Carriers',   contact:fn(), phone:'+256772100002', email:'info@greenfield.ug',  vehicles:3, zones:[ZM.wakiso]                    },
      { company:'Kiggundu Logistics Uganda',   contact:fn(), phone:'+256772100003', email:'ops@kiggundu.ug',    vehicles:2, zones:[ZM.gulu]                       },
      { company:'Atim Brothers Haulage',       contact:fn(), phone:'+256772100004', email:'atim@haulage.ug',    vehicles:2, zones:[ZM.mbarara]                    },
      { company:'Nile Basin Waste Services',   contact:fn(), phone:'+256772100005', email:'info@nilebasin.ug',  vehicles:3, zones:[ZM.kla_central,ZM.wakiso]      },
    ];
    const createdSubs = [];
    for (const sd of subcontractorDefs) {
      const r = await base44.asServiceRole.entities.Subcontractor.create({
        tenant_id:TENANT_ID, company_name:sd.company, contact_name:sd.contact,
        contact_phone:sd.phone, contact_email:sd.email, vehicle_count:sd.vehicles,
        service_zones:sd.zones, status:'active',
        onboarded_at:dateRange(720,90).toISOString(),
        notes:`Subcontractor covering ${sd.zones.length} zone(s).`,
      });
      createdSubs.push({ ...sd, id:r.id });
    }
    log(`Created ${createdSubs.length} subcontractors`);
    await sleep(500);

    // ---- STEP 21: SUBCONTRACTOR JOBS ----
    const subJobBatch = [];
    const activePickupIds = pickupBatch.slice(0, 300);
    for (let i = 0; i < 180; i++) {
      const sub      = pick(createdSubs);
      const pd       = dateRange(720,1);
      const accepted = dateRange(720, 1);
      const status   = pick(['completed','completed','completed','accepted','in_progress','disputed']);
      const payout   = rnd(35000,250000);
      subJobBatch.push({
        tenant_id:TENANT_ID, subcontractor_id:sub.id,
        pickup_request_id:`pr-placeholder-${i}`,
        route_id:null,
        allocated_at: pd.toISOString(),
        accepted_at:  ['accepted','in_progress','completed'].includes(status) ? accepted.toISOString() : null,
        completed_at: status === 'completed' ? new Date(accepted.getTime() + rnd(2,6)*3600000).toISOString() : null,
        completion_evidence_url: status === 'completed' ? `https://storage.example.com/sc${rnd(1000,9999)}.jpg` : null,
        gps_lat: pick(KAMPALA_LOCS).lat + rndF(-0.001,0.001,4),
        gps_lng: pick(KAMPALA_LOCS).lng + rndF(-0.001,0.001,4),
        status,
        payout_ugx: payout,
        payout_status: status === 'completed' ? pick(['paid','paid','pending']) : 'pending',
        dispute_notes: status === 'disputed' ? 'Customer claims collection was not completed.' : null,
        grace_period_days: 1,
      });
    }
    const subJobCount = await safeBulk(base44.asServiceRole.entities.SubcontractorJob, subJobBatch, log);
    log(`Created ${subJobCount} subcontractor jobs`);
    await sleep(500);

    // ---- STEP 22: RECYCLER BUYERS ----
    const recyclerBuyerDefs = [
      { company:'Kampala Plastics Recyclers',     contact:fn(), phone:'+256772200001', email:'buy@kplastics.ug',  materials:['plastic'],           grade:'B', price:650,  radius:30 },
      { company:'UG Paper & Board Ltd',           contact:fn(), phone:'+256772200002', email:'info@ugpaper.ug',   materials:['paper'],             grade:'A', price:900,  radius:50 },
      { company:'Nile Metals Uganda',             contact:fn(), phone:'+256772200003', email:'ops@nilemetals.ug', materials:['metal'],             grade:'B', price:1400, radius:40 },
      { company:'EcoGlass Uganda',                contact:fn(), phone:'+256772200004', email:'buy@ecoglass.ug',   materials:['glass'],             grade:'B', price:400,  radius:25 },
      { company:'GreenCompost Solutions',         contact:fn(), phone:'+256772200005', email:'info@greencompost.ug', materials:['organic'],        grade:'C', price:200,  radius:20 },
      { company:'MultiMaterial Recyclers Ltd',    contact:fn(), phone:'+256772200006', email:'buy@mmrecycle.ug',  materials:['plastic','metal','paper'], grade:'B', price:700, radius:60 },
    ];
    const createdBuyers = [];
    for (const bd of recyclerBuyerDefs) {
      const r = await base44.asServiceRole.entities.RecyclerBuyer.create({
        tenant_id:TENANT_ID, company_name:bd.company, contact_name:bd.contact,
        contact_phone:bd.phone, contact_email:bd.email, materials_wanted:bd.materials,
        min_grade:bd.grade, price_per_kg_ugx:bd.price, pickup_radius_km:bd.radius, status:'active',
      });
      createdBuyers.push({ ...bd, id:r.id });
    }
    log(`Created ${createdBuyers.length} recycler buyers`);
    await sleep(500);

    // ---- STEP 23: MATERIAL LISTINGS ----
    const materials   = ['plastic','paper','metal','glass','organic'];
    const listingBatch = [];
    for (let i = 0; i < 120; i++) {
      const mat    = pick(materials);
      const grade  = pick(['A','A','B','B','C']);
      const qty    = rndF(50,2000,1);
      const aDate  = dateRange(720,7);
      const expiry = new Date(aDate.getTime() + rnd(14,60)*86400000);
      const sold   = Math.random() > 0.4;
      listingBatch.push({
        tenant_id:TENANT_ID, material:mat, grade, quantity_kg:qty,
        location_zone_id: pick([ZM.kla_central, ZM.kla_north, ZM.wakiso]),
        available_from:aDate.toISOString(),
        expires_at: expiry.toISOString(),
        status: sold ? 'sold' : Math.random() > 0.3 ? 'available' : 'reserved',
        ai_estimated_price_ugx: mat === 'metal' ? rnd(1200,1600) : mat === 'paper' ? rnd(700,950) : mat === 'plastic' ? rnd(500,750) : mat === 'glass' ? rnd(300,500) : rnd(150,280),
        waste_bank_agent_id:`agent-${rnd(1,5)}`,
      });
    }
    const listingCount = await safeBulk(base44.asServiceRole.entities.MaterialListing, listingBatch, log);
    log(`Created ${listingCount} material listings`);
    await sleep(500);

    // ---- STEP 24: RECYCLER OFFERS ----
    const offerBatch = [];
    for (let i = 0; i < 90; i++) {
      const buyer    = pick(createdBuyers);
      const qty      = rndF(50,1500,1);
      const offerDate = dateRange(700,7);
      const status   = pick(['completed','completed','accepted','pending','rejected']);
      const settled  = status === 'completed';
      offerBatch.push({
        tenant_id:TENANT_ID, listing_id:`listing-placeholder-${i}`, buyer_id:buyer.id,
        offered_price_per_kg_ugx: buyer.price + rnd(-100,100),
        quantity_kg: qty,
        pickup_date: new Date(offerDate.getTime() + rnd(2,10)*86400000).toISOString(),
        status,
        settlement_ugx: settled ? Math.round(qty * buyer.price) : null,
        settled_at: settled ? new Date(offerDate.getTime() + rnd(5,15)*86400000).toISOString() : null,
      });
    }
    const offerCount = await safeBulk(base44.asServiceRole.entities.RecyclerOffer, offerBatch, log);
    log(`Created ${offerCount} recycler offers`);
    await sleep(500);

    // ---- STEP 25: FACILITY YIELD RECORDS (24 months) ----
    const facilityIds = [`facility-namave-001`, `facility-kiteezi-001`];
    const yieldBatch  = [];
    for (let m = 24; m >= 1; m--) {
      for (const fid of facilityIds) {
        const periodDate = daysAgo(m * 30);
        const inbound    = rndF(120,850,1);
        const recyclable = rndF(inbound*0.2, inbound*0.45, 1);
        const organic    = rndF(inbound*0.15, inbound*0.3, 1);
        const residue    = parseFloat((inbound - recyclable - organic).toFixed(1));
        const diversion  = parseFloat(((1 - residue/inbound)*100).toFixed(1));
        const w2e        = fid.includes('kiteezi');
        yieldBatch.push({
          tenant_id:TENANT_ID, facility_id:fid,
          period:isoDate(periodDate),
          inbound_t:inbound, sorted_recyclable_t:recyclable,
          sorted_organic_t:organic, sorted_residue_t:residue,
          recovered_energy_kwh: w2e ? rnd(12000,85000) : null,
          contamination_rate_pct: rndF(2,18,1),
          diversion_rate_pct:diversion,
          outbound_shipments_json: JSON.stringify([
            { material:'plastic', buyer:'Kampala Plastics Recyclers', quantity_kg:Math.round(recyclable*0.45*1000) },
            { material:'metal',   buyer:'Nile Metals Uganda',          quantity_kg:Math.round(recyclable*0.2*1000)  },
            { material:'paper',   buyer:'UG Paper & Board Ltd',        quantity_kg:Math.round(recyclable*0.35*1000) },
          ]),
          notes:`Monthly yield report for ${isoDate(periodDate)}. Facility: ${fid}.`,
        });
      }
    }
    const yieldCount = await safeBulk(base44.asServiceRole.entities.FacilityYieldRecord, yieldBatch, log);
    log(`Created ${yieldCount} facility yield records`);
    await sleep(500);

    // ---- STEP 26: OUTBOUND SHIPMENTS ----
    const shipmentBatch = [];
    for (let i = 0; i < 100; i++) {
      const buyer    = pick(createdBuyers);
      const mat      = pick(buyer.materials);
      const qty      = rnd(200,8000);
      const shipDate = dateRange(700,7);
      shipmentBatch.push({
        tenant_id:TENANT_ID,
        facility_id: pick(facilityIds),
        material:mat, buyer_id:buyer.id,
        quantity_kg:qty,
        shipped_at:shipDate.toISOString(),
        vehicle_id: pick(activeVehs).dbId,
        manifest_url:`https://storage.example.com/manifest-${rnd(1000,9999)}.pdf`,
        settlement_ugx: Math.round(qty * buyer.price),
      });
    }
    const shipmentCount = await safeBulk(base44.asServiceRole.entities.OutboundShipment, shipmentBatch, log);
    log(`Created ${shipmentCount} outbound shipments`);
    await sleep(500);

    // ---- STEP 27: CAPACITY PLANS ----
    const capBatch = [];
    for (let db = 90; db >= 0; db -= 7) {
      const planDate = daysAgo(db);
      for (const [zoneName, zoneId] of Object.entries(ZM)) {
        const forecast  = rndF(15,120,1);
        const stops     = rnd(30,200);
        const vehicles  = rnd(1,4);
        const crew      = vehicles * 2;
        const capacity  = vehicles * 6;
        const utilPct   = parseFloat(((forecast/capacity)*100).toFixed(1));
        capBatch.push({
          tenant_id:TENANT_ID, plan_date:isoDate(planDate), zone_id:zoneId,
          forecast_demand_t:forecast, forecast_stops:stops,
          available_vehicles:vehicles, available_crew:crew,
          planned_capacity_t:capacity, utilisation_pct:utilPct,
          status: utilPct > 95 ? 'over' : utilPct > 80 ? 'tight' : 'ok',
          notes:`Weekly capacity plan for zone ${zoneName}. Forecast based on historical trends.`,
        });
      }
    }
    const capCount = await safeBulk(base44.asServiceRole.entities.CapacityPlan, capBatch, log);
    log(`Created ${capCount} capacity plans`);
    await sleep(300);

    return Response.json({
      success: true,
      summary: {
        customers:        validCusts.length,
        vehicles:         vehRecs.length,
        subscriptions:    subCount,
        invoices:         invCount,
        payments:         payCount,
        pickups:          pickupCount,
        routes:           routeCount,
        containers:       containerIds.length,
        sensorReadings:   sensorCount,
        fuelLogs:         fuelCount,
        maintenanceOrders:mwCount,
        maintenanceAlerts:maintAlertCount,
        complaints:       compCount,
        tickets:          tktCount,
        surveys:          surveyCount,
        wasteBankTxns:    wbCount,
        inventory:        invBatch.length,
        servicePoints:    spBatch.length,
        subcontractors:   createdSubs.length,
        subcontractorJobs:subJobCount,
        recyclerBuyers:   createdBuyers.length,
        materialListings: listingCount,
        recyclerOffers:   offerCount,
        facilityYields:   yieldCount,
        outboundShipments:shipmentCount,
        capacityPlans:    capCount,
      },
      logs,
    });

  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack?.slice(0,800) }, { status: 500 });
  }
});