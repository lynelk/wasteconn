/**
 * Seed Phase 1: Clear all data, create zones, vehicles, customers, subscriptions
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const TENANT_ID = '69e1364b1f13b6504df1acd0';
const ZONES = { kla_central:'69df3b5fea4c84791cc4c6aa', kla_north:'69df3b5fea4c84791cc4c6a9', wakiso:'69df3b5fea4c84791cc4c6ab' };

function rnd(a,b){return Math.floor(Math.random()*(b-a+1))+a;}
function rndF(a,b,dp=1){return parseFloat((Math.random()*(b-a)+a).toFixed(dp));}
function pick(arr){return arr[Math.floor(Math.random()*arr.length)];}
function isoDate(d){return d.toISOString().split('T')[0];}
function daysAgo(n){const d=new Date('2026-06-20T00:00:00Z');d.setDate(d.getDate()-n);return d;}
function dateRange(s,e){const a=daysAgo(s),b=daysAgo(e);return new Date(a.getTime()+Math.random()*(b.getTime()-a.getTime()));}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
function chunks(arr,size){const out=[];for(let i=0;i<arr.length;i+=size)out.push(arr.slice(i,i+size));return out;}

async function safeBulk(entity,records){
  let created=0;
  for(const batch of chunks(records,15)){
    let att=0;
    while(att<5){
      try{await entity.bulkCreate(batch);created+=batch.length;break;}
      catch(e){if(e.message?.includes('Rate limit')||e.message?.includes('429')){att++;await sleep(3000*att);}else throw e;}
    }
    await sleep(400);
  }
  return created;
}

const KAMPALA_LOCS=[
  {addr:'Nakasero Hill, Kampala',lat:0.3190,lng:32.5795,zone:'kla_central'},
  {addr:'Kololo, Kampala',lat:0.3310,lng:32.5921,zone:'kla_central'},
  {addr:'Bukoto, Kampala',lat:0.3384,lng:32.5982,zone:'kla_north'},
  {addr:'Ntinda, Kampala',lat:0.3521,lng:32.6148,zone:'kla_north'},
  {addr:'Kamwokya, Kampala',lat:0.3421,lng:32.5881,zone:'kla_central'},
  {addr:'Mulago, Kampala',lat:0.3461,lng:32.5762,zone:'kla_north'},
  {addr:'Makerere, Kampala',lat:0.3342,lng:32.5681,zone:'kla_north'},
  {addr:'Wandegeya, Kampala',lat:0.3289,lng:32.5714,zone:'kla_central'},
  {addr:'Lugogo, Kampala',lat:0.3231,lng:32.6012,zone:'kla_central'},
  {addr:'Bugolobi, Kampala',lat:0.3211,lng:32.6151,zone:'kla_central'},
  {addr:'Muyenga, Kampala',lat:0.2831,lng:32.6012,zone:'kla_central'},
  {addr:'Kabalagala, Kampala',lat:0.2910,lng:32.5919,zone:'kla_central'},
  {addr:'Katwe, Kampala',lat:0.3011,lng:32.5751,zone:'kla_central'},
  {addr:'Rubaga, Kampala',lat:0.3052,lng:32.5592,zone:'kla_central'},
  {addr:'Kawempe, Kampala',lat:0.3681,lng:32.5621,zone:'kla_north'},
  {addr:'Kyanja, Kampala',lat:0.3721,lng:32.5941,zone:'kla_north'},
  {addr:'Kiwatule, Kampala',lat:0.3601,lng:32.6221,zone:'kla_north'},
  {addr:'Bwaise, Kampala',lat:0.3551,lng:32.5631,zone:'kla_north'},
  {addr:'Mpererwe, Kampala',lat:0.3812,lng:32.5581,zone:'kla_north'},
  {addr:'Mutungo, Kampala',lat:0.3112,lng:32.6301,zone:'kla_central'},
];
const WAKISO_LOCS=[
  {addr:'Nansana, Wakiso',lat:0.3621,lng:32.5291,zone:'wakiso'},
  {addr:'Kira, Wakiso',lat:0.3841,lng:32.6341,zone:'wakiso'},
  {addr:'Namugongo, Wakiso',lat:0.3921,lng:32.6521,zone:'wakiso'},
  {addr:'Entebbe, Wakiso',lat:0.0621,lng:32.4621,zone:'wakiso'},
  {addr:'Kyaliwajjala, Wakiso',lat:0.3811,lng:32.6421,zone:'wakiso'},
];
const GULU_LOCS=[{addr:'Pece Division, Gulu',lat:2.7741,lng:32.2891,zone:null},{addr:'Layibi Division, Gulu',lat:2.7621,lng:32.2721,zone:null},{addr:'Bardege, Gulu',lat:2.7891,lng:32.2981,zone:null}];
const MBARARA_LOCS=[{addr:'Kakoba Division, Mbarara',lat:-0.6021,lng:30.6521,zone:null},{addr:'Kamukuzi Division, Mbarara',lat:-0.6121,lng:30.6421,zone:null}];
const ARUA_LOCS=[{addr:'Ayivu Division, Arua',lat:3.0221,lng:30.9121,zone:null},{addr:'Arua Hill, Arua',lat:3.0321,lng:30.9221,zone:null}];
const KABALE_LOCS=[{addr:'Kabale Municipality',lat:-1.2521,lng:29.9871,zone:null},{addr:'Rugarama, Kabale',lat:-1.2421,lng:29.9921,zone:null}];

const FIRST=['Moses','Sarah','David','Grace','Robert','Mary','John','Alice','Peter','Ruth','Charles','Agnes','Samuel','Esther','Joseph','Irene','Emmanuel','Prossy','Francis','Josephine','Ronald','Patience','Andrew','Harriet','Michael','Betty','Daniel','Annet','Paul','Edith','George','Flavia','Patrick','Winnie','James','Beatrice','Richard','Jackline','Stephen','Lydia'];
const LAST=['Ssemakula','Nabwire','Okello','Namukasa','Kiggundu','Apio','Mugisha','Nabirye','Ouma','Nalukenge','Tumushabe','Atim','Mutebe','Akello','Sebuliba','Nakato','Byaruhanga','Nanteza','Kiiza','Kemigisha','Musoke','Namutebi','Wanyama','Nakiganda','Sentamu','Amoding','Kato','Nagawa','Lubega','Nankinga'];
const SME=['Ntinda Supermart','Bukoto Hardware','Wandegeya Pharmacy','Kololo Bakery','Kamwokya Quick Foods','Kabalagala Auto Spares','Katwe Metal Works','Kawempe General Store','Kyanja Fuel Station','Kiwatule Electronics','Mutungo Salon','Lugogo Car Wash','Muyenga Supermarket','Namirembe Clinic','Rubaga Print Centre','Nansana Hardware','Kira Pharmacy','Namugongo Bookshop','Entebbe Fresh Market','Pece Supermarket Gulu','Layibi General Store','Kakoba Pharmacy Mbarara'];
const INST=['Makerere University','Mulago National Referral Hospital','Kampala International University','Uganda Christian University','Nakasero Hospital','International Hospital Kampala','Nile Breweries Nakamawa','Uganda Breweries Portbell','Roofings Group Namanve','Bidco Uganda Namanve','Crown Beverages Namanve','Victoria University','Serena Hotel Kampala','Sheraton Kampala Hotel','Gulu University','Mbarara University','Mbarara Regional Referral Hospital'];
const fn=()=>`${pick(FIRST)} ${pick(LAST)}`;

const PLAN_PRICES={res_basic:45000,res_std:65000,res_prem:95000,sme_std:145000,comm_plus:380000,inst_prem:680000,enterprise:1650000,university:2800000};
const PLAN_IDS={res_basic:'6a309c5aea19bff65690992f',res_std:'6a309c5aea19bff656909930',res_prem:'6a309c5aea19bff656909931',sme_std:'6a309c5aea19bff656909932',comm_plus:'6a309c5aea19bff656909933',inst_prem:'6a309c5aea19bff656909934',enterprise:'6a309c5aea19bff656909935',university:'6a309c5aea19bff656909936'};

Deno.serve(async(req)=>{
  try{
    const base44=createClientFromRequest(req);
    const user=await base44.auth.me();
    if(user?.role!=='admin')return Response.json({error:'Admin only'},{status:403});

    const logs=[];
    const log=(m)=>{logs.push(m);console.log('[P1]',m);};

    // CLEAR
    const CLEAR=['Customer','Vehicle','PickupRequest','Payment','Invoice','Subscription','Complaint','Route','Container','SensorReading','FuelLog','MaintenanceWorkOrder','CustomerSatisfaction','Ticket','WasteBankTransaction','Inventory','ServicePoint','Contract','RouteFeedback','AuditLog','Notification','FleetAlert','DriverLocation','ComplianceReport','ReportSnapshot','SubcontractorJob','Subcontractor','RecyclerOffer','RecyclerBuyer','MaterialListing','FacilityYieldRecord','OutboundShipment','MaintenanceAlert','CapacityPlan'];
    for(const name of CLEAR){
      try{
        let done=false;
        for(let page=0;page<10&&!done;page++){
          const all=await base44.asServiceRole.entities[name].list('id',200);
          if(!all.length){done=true;break;}
          for(const r of all)await base44.asServiceRole.entities[name].delete(r.id);
          await sleep(300);
        }
      }catch(e){}
    }
    log('Cleared old data');
    await sleep(1000);

    // ZONES
    await base44.asServiceRole.entities.ServiceZone.update(ZONES.kla_central,{tenant_id:TENANT_ID,zone_name:'Kampala Central Zone',region:'Central',district:'KAMPALA',county:'KAMPALA CENTRAL DIVISION',sub_county:'CENTRAL DIVISION',collection_days:['tuesday','friday'],collection_time:'07:00 - 10:00',status:'active',max_customers:200});
    await base44.asServiceRole.entities.ServiceZone.update(ZONES.kla_north,{tenant_id:TENANT_ID,zone_name:'Kampala North Zone',region:'Central',district:'KAMPALA',county:'KAWEMPE DIVISION NORTH',sub_county:'KAWEMPE DIVISION',collection_days:['monday','thursday'],collection_time:'07:00 - 10:00',status:'active',max_customers:150});
    await base44.asServiceRole.entities.ServiceZone.update(ZONES.wakiso,{tenant_id:TENANT_ID,zone_name:'Wakiso Metro Zone',region:'Central',district:'WAKISO',county:'KYADONDO',sub_county:'NANSANA DIVISION',collection_days:['wednesday','saturday'],collection_time:'07:30 - 10:30',status:'active',max_customers:120});
    const guluZ=await base44.asServiceRole.entities.ServiceZone.create({tenant_id:TENANT_ID,zone_name:'Gulu City Zone',region:'Northern',district:'GULU',county:'GULU MUNICIPAL COUNCIL',sub_county:'LAROO DIVISION',collection_days:['tuesday','saturday'],collection_time:'07:00 - 10:00',status:'active',max_customers:60});
    const mbZ=await base44.asServiceRole.entities.ServiceZone.create({tenant_id:TENANT_ID,zone_name:'Mbarara City Zone',region:'Western',district:'MBARARA',county:'MBARARA MUNICIPAL COUNCIL',sub_county:'KAKOBA DIVISION',collection_days:['monday','thursday'],collection_time:'07:30 - 10:00',status:'active',max_customers:45});
    const aruaZ=await base44.asServiceRole.entities.ServiceZone.create({tenant_id:TENANT_ID,zone_name:'Arua City Zone',region:'West Nile',district:'ARUA',county:'ARUA MUNICIPALITY',sub_county:'AYIVU DIVISION',collection_days:['wednesday'],collection_time:'08:00 - 11:00',status:'active',max_customers:30});
    const kabZ=await base44.asServiceRole.entities.ServiceZone.create({tenant_id:TENANT_ID,zone_name:'Kabale Zone',region:'Western',district:'KABALE',county:'KABALE MUNICIPALITY',sub_county:'KABALE DIVISION',collection_days:['friday'],collection_time:'08:00 - 11:00',status:'active',max_customers:25});
    const ZM={kla_central:ZONES.kla_central,kla_north:ZONES.kla_north,wakiso:ZONES.wakiso,gulu:guluZ.id,mbarara:mbZ.id,arua:aruaZ.id,kabale:kabZ.id};
    log('Zones ready');

    // VEHICLES
    const VD=[
      {reg:'UAX 123K',type:'compactor',model:'Isuzu NPR',yr:2021,cap:5,notes:'Kampala Central primary'},
      {reg:'UBG 456M',type:'tipper',model:'Tata LPT 1613',yr:2019,cap:4,notes:'Skip collection Lugogo'},
      {reg:'UAP 789J',type:'compactor',model:'Hino 500',yr:2022,cap:7,notes:'Kampala North route'},
      {reg:'UBC 321L',type:'flatbed',model:'Mitsubishi Fuso',yr:2020,cap:6,notes:'Brake service',st:'maintenance'},
      {reg:'UBK 654N',type:'compactor',model:'Isuzu FRR',yr:2023,cap:5,notes:'Gulu City'},
      {reg:'UAV 987G',type:'tipper',model:'Tata 407',yr:2018,cap:3,notes:'Mbarara'},
      {reg:'UBA 159P',type:'compactor',model:'Hino 300',yr:2021,cap:5,notes:'Upcountry'},
      {reg:'UBN 222Q',type:'tipper',model:'Isuzu ELF',yr:2022,cap:4,notes:'Wakiso Metro'},
    ];
    const vehIds=[];
    for(const v of VD){
      const ls=daysAgo(rnd(30,180));const ns=new Date(ls);ns.setDate(ns.getDate()+90);
      const r=await base44.asServiceRole.entities.Vehicle.create({tenant_id:TENANT_ID,registration_number:v.reg,vehicle_type:v.type,make_model:v.model,year:v.yr,capacity_tonnes:v.cap,fuel_type:'diesel',status:v.st||'active',last_service_date:isoDate(ls),next_service_date:isoDate(ns),notes:v.notes});
      vehIds.push({...v,dbId:r.id});
    }
    log(`Created ${vehIds.length} vehicles`);

    // CUSTOMERS
    function zoneFor(loc,dist){
      if(dist==='GULU')return ZM.gulu;if(dist==='MBARARA')return ZM.mbarara;
      if(dist==='ARUA')return ZM.arua;if(dist==='KABALE')return ZM.kabale;
      if(dist==='WAKISO')return ZM.wakiso;
      return loc.zone?ZM[loc.zone]:ZM.kla_central;
    }
    const custDefs=[];let acc=1001;
    function pushCust(type,seg,tier,locPool,planKey,dist,qty){
      for(let i=0;i<qty;i++){
        const loc=pick(locPool);
        const jit={lat:loc.lat+rndF(-0.002,0.002,4),lng:loc.lng+rndF(-0.002,0.002,4)};
        const momoP=pick(['mtn','mtn','airtel','none']);
        const phone=`+2567${rnd(10,99)}${rnd(100000,999999)}`;
        const name=seg==='institution'?pick(INST):seg==='sme'?pick(SME):fn();
        custDefs.push({type,seg,tier,loc,jit,planKey,dist,momoP,phone,name,acct:`ACC-${acc++}`,zone:zoneFor(loc,dist),status:Math.random()>0.07?'active':(Math.random()>0.5?'inactive':'suspended')});
      }
    }
    pushCust('residential','individual','basic',KAMPALA_LOCS,'res_basic','KAMPALA',62);
    pushCust('residential','individual','standard',KAMPALA_LOCS,'res_std','KAMPALA',32);
    pushCust('residential','individual','premium',KAMPALA_LOCS,'res_prem','KAMPALA',14);
    pushCust('commercial','sme','standard',KAMPALA_LOCS,'sme_std','KAMPALA',20);
    pushCust('commercial','sme','standard',KAMPALA_LOCS,'comm_plus','KAMPALA',12);
    pushCust('commercial','institution','premium',KAMPALA_LOCS,'inst_prem','KAMPALA',9);
    pushCust('industrial','institution','enterprise',KAMPALA_LOCS,'enterprise','KAMPALA',5);
    pushCust('commercial','institution','enterprise',KAMPALA_LOCS,'university','KAMPALA',4);
    pushCust('residential','individual','basic',WAKISO_LOCS,'res_basic','WAKISO',10);
    pushCust('commercial','sme','standard',WAKISO_LOCS,'sme_std','WAKISO',5);
    pushCust('commercial','institution','premium',WAKISO_LOCS,'inst_prem','WAKISO',3);
    pushCust('residential','individual','basic',GULU_LOCS,'res_basic','GULU',6);
    pushCust('commercial','sme','standard',GULU_LOCS,'sme_std','GULU',4);
    pushCust('commercial','institution','premium',GULU_LOCS,'inst_prem','GULU',2);
    pushCust('residential','individual','basic',MBARARA_LOCS,'res_std','MBARARA',4);
    pushCust('commercial','sme','standard',MBARARA_LOCS,'comm_plus','MBARARA',2);
    pushCust('commercial','institution','premium',MBARARA_LOCS,'inst_prem','MBARARA',1);
    pushCust('residential','individual','basic',ARUA_LOCS,'res_basic','ARUA',3);
    pushCust('commercial','sme','standard',ARUA_LOCS,'sme_std','ARUA',2);
    pushCust('residential','individual','basic',KABALE_LOCS,'res_basic','KABALE',3);
    pushCust('commercial','sme','standard',KABALE_LOCS,'sme_std','KABALE',2);

    const custBatch=custDefs.map(c=>({
      tenant_id:TENANT_ID,full_name:c.name,phone:c.phone,
      email:c.seg!=='individual'?`admin@${c.name.toLowerCase().replace(/[^a-z]/g,'-').replace(/-+/g,'-').slice(0,18)}.ug`:`${c.name.toLowerCase().replace(/\s/g,'.')}@gmail.com`,
      customer_type:c.type,customer_segment:c.seg,customer_tier:c.tier,account_number:c.acct,
      address:c.loc.addr,latitude:c.jit.lat,longitude:c.jit.lng,district:c.dist,zone_id:c.zone,status:c.status,
      mobile_money_provider:c.momoP,mobile_money_number:c.momoP!=='none'?c.phone:null,
      preferred_language:c.dist==='KAMPALA'?pick(['english','luganda','english']):'english',
      bin_count:c.seg==='institution'?rnd(3,12):c.seg==='sme'?rnd(2,5):rnd(1,3),
      estimated_waste_kg_month:c.type==='industrial'?rnd(2000,12000):c.type==='commercial'?rnd(150,2000):rnd(20,110),
      onboarding_source:pick(['manual','bulk_import','self_service','referral']),
      churn_risk_score:rnd(0,85),
      institution_name:c.seg==='institution'?c.name:null,
      contact_person:c.seg!=='individual'?fn():null,
      num_branches:c.seg==='institution'?rnd(1,4):1,
      tier_auto_classified:Math.random()>0.5,
    }));

    const createdCusts=[];
    for(const batch of chunks(custBatch,15)){
      let att=0;
      while(att<5){
        try{const res=await base44.asServiceRole.entities.Customer.bulkCreate(batch);if(Array.isArray(res))createdCusts.push(...res);break;}
        catch(e){if(e.message?.includes('Rate limit')||e.message?.includes('429')){att++;await sleep(3000*att);}else throw e;}
      }
      await sleep(500);
    }
    for(let i=0;i<custDefs.length&&i<createdCusts.length;i++)custDefs[i].id=createdCusts[i]?.id||createdCusts[i]?._id;
    const validCusts=custDefs.filter(c=>c.id);
    log(`Created ${validCusts.length} customers`);
    await sleep(500);

    // SUBSCRIPTIONS
    const subBatch=validCusts.map(c=>{
      const sd=dateRange(720,30);
      const pm=c.momoP==='mtn'?'mtn_momo':c.momoP==='airtel'?'airtel_money':pick(['cash','bank_transfer']);
      const freq=['res_basic','res_std'].includes(c.planKey)?'weekly':['res_prem','sme_std'].includes(c.planKey)?'twice_weekly':'daily';
      return{tenant_id:TENANT_ID,customer_id:c.id,plan_id:PLAN_IDS[c.planKey],zone_id:c.zone,billing_model:'postpaid',status:c.status==='active'?'active':'cancelled',start_date:isoDate(sd),contract_duration_months:['enterprise','university','inst_prem'].includes(c.planKey)?12:3,auto_renew:true,next_billing_date:isoDate(daysAgo(-14)),amount_ugx:PLAN_PRICES[c.planKey],discount_pct:Math.random()<0.1?rnd(5,20):0,payment_method:pm,service_frequency:freq,collection_days:['monday','thursday'],contract_signed:true,contract_signed_date:isoDate(sd),contract_version:1,amendment_history:[],renewal_reminder_sent:false};
    });
    const subCount=await safeBulk(base44.asServiceRole.entities.Subscription,subBatch);
    log(`Created ${subCount} subscriptions`);

    // Store zone/vehicle map for phase 2
    const zoneMap=ZM;
    const vehMap=vehIds;
    const custMap=validCusts.map(c=>({id:c.id,planKey:c.planKey,momoP:c.momoP,phone:c.phone,type:c.type,seg:c.seg,zone:c.zone,status:c.status,locAddr:c.loc.addr,jitLat:c.jit.lat,jitLng:c.jit.lng}));

    return Response.json({success:true,logs,zoneMap,vehMap,custMap,summary:{customers:validCusts.length,subscriptions:subCount}});
  }catch(error){
    return Response.json({error:error.message,stack:error.stack?.slice(0,600)},{status:500});
  }
});