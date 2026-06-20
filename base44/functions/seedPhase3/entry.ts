/**
 * Seed Phase 3: Maintenance, Complaints, Tickets, Surveys, WasteBank, Inventory,
 *               Containers, Subcontractors, RecyclerBuyers, Listings, Offers,
 *               FacilityYield, OutboundShipments, CapacityPlans
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const TENANT_ID='69e1364b1f13b6504df1acd0';
function rnd(a,b){return Math.floor(Math.random()*(b-a+1))+a;}
function rndF(a,b,dp=1){return parseFloat((Math.random()*(b-a)+a).toFixed(dp));}
function pick(arr){return arr[Math.floor(Math.random()*arr.length)];}
function isoDate(d){return d.toISOString().split('T')[0];}
function daysAgo(n){const d=new Date('2026-06-20T00:00:00Z');d.setDate(d.getDate()-n);return d;}
function dateRange(s,e){const a=daysAgo(s),b=daysAgo(e);return new Date(a.getTime()+Math.random()*(b.getTime()-a.getTime()));}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
function chunks(arr,size){const out=[];for(let i=0;i<arr.length;i+=size)out.push(arr.slice(i,i+size));return out;}
async function safeBulk(entity,records,skipErrors=false){
  let created=0;
  for(const batch of chunks(records,15)){
    let att=0;
    while(att<5){
      try{await entity.bulkCreate(batch);created+=batch.length;break;}
      catch(e){
        if(e.message?.includes('Rate limit')||e.message?.includes('429')){att++;await sleep(3500*att);}
        else if(skipErrors){console.error('[SKIP]',e.message?.slice(0,120));break;}
        else throw e;
      }
    }
    await sleep(500);
  }
  return created;
}

const fn=()=>{const F=['Moses','Sarah','David','Grace','Robert','Mary','John','Alice','Peter','Ruth','Charles','Agnes','Samuel','Esther','Joseph','Irene'];const L=['Ssemakula','Nabwire','Okello','Namukasa','Kiggundu','Apio','Mugisha','Nabirye','Ouma','Nalukenge','Tumushabe','Atim'];return `${pick(F)} ${pick(L)}`;};

Deno.serve(async(req)=>{
  try{
    const base44=createClientFromRequest(req);
    const user=await base44.auth.me();
    if(user?.role!=='admin')return Response.json({error:'Admin only'},{status:403});
    const logs=[];
    const log=(m)=>{logs.push(m);console.log('[P3]',m);};

    // Load base data
    const allCustomers=await base44.asServiceRole.entities.Customer.list('created_date',200);
    const allVehicles=await base44.asServiceRole.entities.Vehicle.list();
    const allZones=await base44.asServiceRole.entities.ServiceZone.list();
    const allPickups=await base44.asServiceRole.entities.PickupRequest.list('created_date',200);
    const activeVehs=allVehicles.filter(v=>v.status!=='maintenance');
    log(`Loaded ${allCustomers.length} customers, ${allVehicles.length} vehicles, ${allZones.length} zones, ${allPickups.length} pickups`);

    const DRIVERS=['DRV-001','DRV-002','DRV-003','DRV-004','DRV-005','DRV-006','DRV-007','DRV-008'];

    // MAINTENANCE WORK ORDERS
    const mwTitles=['Oil & Filter Change','Brake Pad Replacement','Tyre Rotation & Alignment','Hydraulic System Check','Compactor Blade Service','Engine Tune-Up','Air Filter Replacement','Battery Replacement','Transmission Service','Suspension Overhaul'];
    const mwBatch=[];
    for(const v of allVehicles){
      for(let i=0;i<rnd(6,14);i++){
        const od=dateRange(720,10);const done=Math.random()>0.2;
        mwBatch.push({tenant_id:TENANT_ID,vehicle_id:v.id,title:pick(mwTitles),order_type:pick(['preventive','corrective','corrective','predictive']),status:done?'completed':pick(['open','in_progress']),priority:pick(['low','medium','high','critical']),description:`Service on ${v.make_model}. Returned to Namave depot.`,scheduled_date:isoDate(od),completed_date:done?isoDate(new Date(od.getTime()+rnd(1,5)*86400000)):null,assigned_technician:pick(['Ssemakula Brian','Okello Denis','Kato Ivan','Mwesigye Paul']),cost_ugx:done?rnd(80000,2800000):null,parts_used:done?pick(['Brake pads x4','Engine oil 15L + filter','Air & fuel filter','Tyres x2','Hydraulic fluid 10L']):null,ai_prediction_score:rndF(10,85,0)});
      }
    }
    const mwCount=await safeBulk(base44.asServiceRole.entities.MaintenanceWorkOrder,mwBatch);
    log(`Created ${mwCount} maintenance work orders`);

    // MAINTENANCE ALERTS
    const alertTypes=['service_due','fault_code','excessive_idle','harsh_driving','low_fuel'];
    const maBatch=[];
    for(const v of allVehicles){
      for(let i=0;i<rnd(3,8);i++){
        const atype=pick(alertTypes);const resolved=Math.random()>0.4;const ad=dateRange(720,1);
        maBatch.push({tenant_id:TENANT_ID,vehicle_id:v.id,alert_type:atype,severity:atype==='fault_code'?'critical':pick(['info','warning','warning','critical']),fault_code:atype==='fault_code'?`P${rnd(1000,2999)}`:null,description:`${atype.replace(/_/g,' ')} detected on vehicle ${v.registration_number}. Inspection recommended.`,predicted_service_date:isoDate(new Date(ad.getTime()+rnd(7,30)*86400000)),ai_recommended_action:pick(['Schedule service within 7 days','Inspect brake system','Check engine oil level','Reduce idle time','Refuel at next depot stop']),status:resolved?'resolved':pick(['open','scheduled']),resolved_at:resolved?new Date(ad.getTime()+rnd(1,10)*86400000).toISOString():null});
      }
    }
    const maCount=await safeBulk(base44.asServiceRole.entities.MaintenanceAlert,maBatch);
    log(`Created ${maCount} maintenance alerts`);
    await sleep(500);

    // COMPLAINTS
    const compCats=['missed_collection','billing','driver_behaviour','overflowing_bin','illegal_dumping','damaged_bin','service_quality','other'];
    const compBatch=[];
    for(let i=0;i<200;i++){
      const c=pick(allCustomers);const cat=pick(compCats);const cd=dateRange(720,0);const res=Math.random()>0.35;
      compBatch.push({tenant_id:TENANT_ID,customer_id:c.id,category:cat,subject:`${cat.replace(/_/g,' ')} - ${c.address?.split(',')[0]||'Kampala'}`,description:`Customer reports ${cat.replace(/_/g,' ')} at ${c.address||'site'}. Requires urgent attention.`,status:res?pick(['resolved','closed']):pick(['open','in_review']),priority:pick(['low','medium','high','urgent']),source:pick(['customer_app','email','phone','public_report','in_app']),latitude:c.latitude,longitude:c.longitude,resolved_at:res?new Date(cd.getTime()+rnd(1,5)*86400000).toISOString():null,resolution_notes:res?'Issue investigated and resolved. Driver coached.':null,ai_sentiment:'negative',ai_escalate:Math.random()<0.15,ai_estimated_resolution_hours:pick([4,8,12,24,48]),rating:res?rnd(1,5):null});
    }
    const compCount=await safeBulk(base44.asServiceRole.entities.Complaint,compBatch);
    log(`Created ${compCount} complaints`);

    // TICKETS
    const tktCats=['missed_collection','billing_dispute','service_quality','access_issue','bin_damage','driver_behaviour','general_inquiry'];
    const tktBatch=[];
    for(let i=0;i<150;i++){
      const c=pick(allCustomers);const cat=pick(tktCats);const td=dateRange(720,0);const res=Math.random()>0.3;const sla=rnd(12,72);
      const zoneId=c.zone_id||allZones[0]?.id||'';
      tktBatch.push({tenant_id:TENANT_ID,customer_id:c.id,ticket_number:`TKT-${String(2000+i).padStart(5,'0')}`,category:cat,subject:`${cat.replace(/_/g,' ')} - ${c.address?.split(',')[0]||'Kampala'}`,description:`Customer reports ${cat.replace(/_/g,' ')} issue.`,status:res?pick(['resolved','closed']):pick(['open','triaged','assigned','in_progress']),priority:pick(['low','medium','high','urgent']),source:pick(['in_app','email','phone','whatsapp','web_form']),zone_id:zoneId,sla_hours:sla,sla_due_at:new Date(td.getTime()+sla*3600000).toISOString(),sla_breached:!res&&Math.random()<0.18,resolved_at:res?new Date(td.getTime()+rnd(2,48)*3600000).toISOString():null,resolution_notes:res?'Investigated and resolved. Customer notified.':null,ai_category:cat,ai_priority:pick(['low','medium','high']),ai_sentiment:'negative',closure_verified:res&&Math.random()>0.5});
    }
    const tktCount=await safeBulk(base44.asServiceRole.entities.Ticket,tktBatch);
    log(`Created ${tktCount} tickets`);
    await sleep(500);

    // SATISFACTION SURVEYS
    const surveyBatch=[];
    for(const c of allCustomers.slice(0,140)){
      for(let i=0;i<rnd(1,4);i++){
        const rating=rnd(1,5);
        surveyBatch.push({tenant_id:TENANT_ID,customer_id:c.id,zone_id:c.zone_id,driver_id:pick(DRIVERS),rating,comment:rating>=4?pick(['Excellent service!','Very professional','On time, great work']):rating===3?'Service was okay':pick(['Driver was late','Bin not fully emptied','Poor service']),channel:pick(['in_app','sms','email']),responded_at:dateRange(720,0).toISOString(),ai_sentiment:rating>=4?'positive':rating===3?'neutral':'negative',ai_pain_points:rating<3?[pick(['punctuality','driver_behaviour','incomplete_collection'])]:[]});
      }
    }
    const surveyCount=await safeBulk(base44.asServiceRole.entities.CustomerSatisfaction,surveyBatch);
    log(`Created ${surveyCount} satisfaction surveys`);

    // WASTE BANK TRANSACTIONS
    const wbCats=['plastic','paper','glass','metal','organic','mixed'];
    const wbRates=[500,800,1200,1500,600,300];
    const wbBatch=[];
    for(let i=0;i<280;i++){
      const c=pick(allCustomers.filter(x=>x.customer_type!=='industrial'));
      const wt=rndF(0.5,50,1);const rate=pick(wbRates);const gross=Math.round(wt*rate);const ded=Math.round(gross*rndF(0,0.08,2));
      wbBatch.push({tenant_id:TENANT_ID,customer_id:c.id,transaction_number:`WBT-${String(3000+i).padStart(5,'0')}`,transaction_type:'payout',zone_id:c.zone_id,waste_category:pick(wbCats),grade:pick(['A','A','B','B','C']),weight_kg:wt,rate_ugx_per_kg:rate,gross_amount_ugx:gross,deductions_ugx:ded,net_amount_ugx:gross-ded,payment_method:c.mobile_money_provider==='mtn'?'mtn_momo':c.mobile_money_provider==='airtel'?'airtel_money':'cash',mobile_money_number:c.mobile_money_number||null,payment_status:'completed',payment_reference:`WB-${rnd(100000,999999)}`,gps_lat:c.latitude,gps_lon:c.longitude,fraud_flag:false,ai_grade_suggestion:pick(['A','B','B'])});
    }
    const wbCount=await safeBulk(base44.asServiceRole.entities.WasteBankTransaction,wbBatch);
    log(`Created ${wbCount} waste bank transactions`);
    await sleep(500);

    // INVENTORY
    const invItems=[
      {item_name:'High-Density Waste Bags 120L',category:'bags',unit:'boxes',stock:rnd(20,80),threshold:10,reorder:50,cost:rnd(45000,80000)},
      {item_name:'Safety Gloves (Heavy Duty)',category:'safety_gear',unit:'units',stock:rnd(30,100),threshold:20,reorder:80,cost:rnd(8000,15000)},
      {item_name:'Hi-Vis Safety Vests',category:'ppe',unit:'units',stock:rnd(10,30),threshold:8,reorder:30,cost:rnd(12000,25000)},
      {item_name:'Diesel Fuel Cans 20L',category:'fuel_cans',unit:'units',stock:rnd(5,20),threshold:5,reorder:20,cost:rnd(180000,250000)},
      {item_name:'Safety Boots Size 42-45',category:'ppe',unit:'units',stock:rnd(5,15),threshold:4,reorder:12,cost:rnd(55000,90000)},
      {item_name:'Hydraulic Oil 20L',category:'tools',unit:'units',stock:rnd(4,12),threshold:3,reorder:10,cost:rnd(120000,200000)},
      {item_name:'Compactor Blade Set',category:'tools',unit:'units',stock:rnd(2,6),threshold:2,reorder:4,cost:rnd(450000,800000)},
      {item_name:'Engine Oil 15W40 5L',category:'tools',unit:'units',stock:rnd(8,25),threshold:5,reorder:20,cost:rnd(65000,95000)},
      {item_name:'Face Masks Box of 50',category:'ppe',unit:'boxes',stock:rnd(10,40),threshold:6,reorder:30,cost:rnd(25000,40000)},
      {item_name:'Tyre Repair Kit',category:'tools',unit:'units',stock:rnd(3,8),threshold:2,reorder:6,cost:rnd(80000,150000)},
      {item_name:'Warning Cones Traffic',category:'safety_gear',unit:'units',stock:rnd(8,20),threshold:6,reorder:20,cost:rnd(15000,30000)},
      {item_name:'First Aid Kit',category:'other',unit:'units',stock:rnd(3,8),threshold:2,reorder:5,cost:rnd(45000,80000)},
    ];
    const invBatch=invItems.map(item=>({tenant_id:TENANT_ID,item_name:item.item_name,category:item.category,sku:`SKU-${rnd(10000,99999)}`,current_stock:item.stock,unit_of_measure:item.unit,safety_threshold:item.threshold,reorder_quantity:item.reorder,unit_cost_ugx:item.cost,supplier_name:pick(['Kampala Hardware Ltd','Crane Supplies','Total Uganda','Quality Spares KLA','Industrial Supplies UG']),location:'Namave Industrial Park Warehouse',last_restocked_date:isoDate(daysAgo(rnd(7,60))),po_status:item.stock<=item.threshold?'pending':'none'}));
    await safeBulk(base44.asServiceRole.entities.Inventory,invBatch);
    log(`Created ${invBatch.length} inventory items`);

    // SERVICE POINTS
    const instCusts=allCustomers.filter(c=>c.customer_segment==='institution').slice(0,30);
    const spBatch=instCusts.map(c=>({tenant_id:TENANT_ID,customer_id:c.id,zone_id:c.zone_id,name:`${(c.address||'Site').split(',')[0]} Service Point`,address:c.address||'Kampala',latitude:c.latitude,longitude:c.longitude,status:'active',collection_days:['monday','wednesday','friday'],collection_time:'07:00 - 09:00',bin_count:rnd(2,8),waste_streams:['general','recyclable']}));
    await safeBulk(base44.asServiceRole.entities.ServicePoint,spBatch);
    log(`Created ${spBatch.length} service points`);
    await sleep(500);

    // CONTAINERS
    const containerBatch=[];
    for(let i=0;i<40;i++){
      const z=pick(allZones);const isSkip=Math.random()<0.2;const fill=rnd(5,99);
      containerBatch.push({tenant_id:TENANT_ID,label:`Zone ${z.zone_name?.split(' ')[0]} Bin ${i+1}`,qr_code:`QR-BIN-${String(i+1).padStart(3,'0')}`,asset_category:isSkip?'skip':'smart_bin',fill_logic_type:isSkip?'weight':'volume',zone_id:z.id,waste_stream:pick(['general','general','recyclable','organic']),status:Math.random()>0.08?'active':'maintenance',latitude:(z.id.charCodeAt(0)%2===0?0.32:0.37)+rndF(-0.01,0.01,4),longitude:32.58+rndF(-0.05,0.1,4),address:`${z.zone_name} area`,capacity_litres:isSkip?null:pick([120,240,360]),max_weight_kg:isSkip?pick([1000,2000,3000]):null,collection_threshold_pct:rnd(75,90),last_fill_pct:fill,last_battery_pct:isSkip?null:rnd(20,100),last_weight_kg:isSkip?rnd(200,2800):null,last_reading_at:daysAgo(rnd(0,2)).toISOString(),avg_daily_fill_rate_pct:isSkip?null:rndF(3,22,1),avg_daily_weight_gain_kg:isSkip?rndF(50,400,1):null,sensor_id:`SNS-${String(i+1).padStart(3,'0')}`,firmware_version:pick(['v2.3.1','v2.3.2','v2.4.0','v1.8.0'])});
    }
    const containerIds=[];
    for(const batch of chunks(containerBatch,15)){
      let att=0;
      while(att<5){
        try{const res=await base44.asServiceRole.entities.Container.bulkCreate(batch);if(Array.isArray(res))containerIds.push(...res.map(r=>r.id||r._id));break;}
        catch(e){if(e.message?.includes('Rate limit')||e.message?.includes('429')){att++;await sleep(3500*att);}else throw e;}
      }
      await sleep(500);
    }
    log(`Created ${containerIds.length} containers`);

    // SENSOR READINGS
    const sensorBatch=[];
    for(const cid of containerIds.slice(0,10)){
      let fill=rnd(10,40);
      for(let h=45*24;h>=0;h-=6){
        fill=Math.min(100,fill+rndF(0,3,1));if(fill>85)fill=rnd(5,15);
        sensorBatch.push({tenant_id:TENANT_ID,container_id:cid,sensor_id:'SNS-AUTO',fill_level_pct:fill,distance_cm:Math.round((1-fill/100)*120),battery_pct:rnd(25,100),temperature_c:rndF(22,35,1),tilt_detected:false,fire_detected:false,measured_at:daysAgo(h/24).toISOString(),source:'ultrasonic'});
      }
    }
    const sensorCount=await safeBulk(base44.asServiceRole.entities.SensorReading,sensorBatch);
    log(`Created ${sensorCount} sensor readings`);
    await sleep(500);

    // SUBCONTRACTORS
    const subDefs=[
      {company:'Ssemakula Transport Ltd',phone:'+256772100001',email:'ops@ssemakula.co.ug',vehicles:4},
      {company:'Greenfield Waste Carriers',phone:'+256772100002',email:'info@greenfield.ug',vehicles:3},
      {company:'Kiggundu Logistics Uganda',phone:'+256772100003',email:'ops@kiggundu.ug',vehicles:2},
      {company:'Atim Brothers Haulage',phone:'+256772100004',email:'atim@haulage.ug',vehicles:2},
      {company:'Nile Basin Waste Services',phone:'+256772100005',email:'info@nilebasin.ug',vehicles:3},
    ];
    const createdSubs=[];
    for(const sd of subDefs){
      const zones=allZones.slice(0,rnd(1,3)).map(z=>z.id);
      const r=await base44.asServiceRole.entities.Subcontractor.create({tenant_id:TENANT_ID,company_name:sd.company,contact_name:fn(),contact_phone:sd.phone,contact_email:sd.email,vehicle_count:sd.vehicles,service_zones:zones,status:'active',onboarded_at:dateRange(720,90).toISOString(),notes:`Subcontractor covering ${zones.length} zone(s).`});
      createdSubs.push({...sd,id:r.id,zones});
    }
    log(`Created ${createdSubs.length} subcontractors`);

    // SUBCONTRACTOR JOBS
    // Use valid pickup IDs; filter out any without .id
    const pickupIds=allPickups.map(p=>p.id||p._id).filter(Boolean);
    const subJobBatch=[];
    const subJobQty=Math.min(150,pickupIds.length);
    for(let i=0;i<subJobQty;i++){
      const sub=pick(createdSubs);const pd=dateRange(720,1);const accepted=new Date(pd.getTime()+rnd(1,4)*3600000);
      const status=pick(['completed','completed','completed','accepted','in_progress','disputed']);
      const payout=rnd(35000,250000);
      const pickupRef=pickupIds[i%pickupIds.length];
      subJobBatch.push({tenant_id:TENANT_ID,subcontractor_id:sub.id,pickup_request_id:pickupRef,route_id:null,allocated_at:pd.toISOString(),accepted_at:['accepted','in_progress','completed'].includes(status)?accepted.toISOString():null,completed_at:status==='completed'?new Date(accepted.getTime()+rnd(2,6)*3600000).toISOString():null,completion_evidence_url:status==='completed'?`https://storage.example.com/sc${rnd(1000,9999)}.jpg`:null,gps_lat:0.32+rndF(-0.05,0.05,4),gps_lng:32.58+rndF(-0.05,0.1,4),status,payout_ugx:payout,payout_status:status==='completed'?pick(['paid','paid','pending']):'pending',dispute_notes:status==='disputed'?'Customer claims collection was not completed.':null,grace_period_days:1});
    }
    log(`Building ${subJobBatch.length} subcontractor jobs from ${pickupIds.length} pickup IDs`);
    const subJobCount=await safeBulk(base44.asServiceRole.entities.SubcontractorJob,subJobBatch,true);
    log(`Created ${subJobCount} subcontractor jobs`);
    await sleep(500);

    // RECYCLER BUYERS
    const buyerDefs=[
      {company:'Kampala Plastics Recyclers',phone:'+256772200001',email:'buy@kplastics.ug',materials:['plastic'],grade:'B',price:650,radius:30},
      {company:'UG Paper & Board Ltd',phone:'+256772200002',email:'info@ugpaper.ug',materials:['paper'],grade:'A',price:900,radius:50},
      {company:'Nile Metals Uganda',phone:'+256772200003',email:'ops@nilemetals.ug',materials:['metal'],grade:'B',price:1400,radius:40},
      {company:'EcoGlass Uganda',phone:'+256772200004',email:'buy@ecoglass.ug',materials:['glass'],grade:'B',price:400,radius:25},
      {company:'GreenCompost Solutions',phone:'+256772200005',email:'info@greencompost.ug',materials:['organic'],grade:'C',price:200,radius:20},
      {company:'MultiMaterial Recyclers Ltd',phone:'+256772200006',email:'buy@mmrecycle.ug',materials:['plastic','metal','paper'],grade:'B',price:700,radius:60},
    ];
    const createdBuyers=[];
    for(const bd of buyerDefs){
      const r=await base44.asServiceRole.entities.RecyclerBuyer.create({tenant_id:TENANT_ID,company_name:bd.company,contact_name:fn(),contact_phone:bd.phone,contact_email:bd.email,materials_wanted:bd.materials,min_grade:bd.grade,price_per_kg_ugx:bd.price,pickup_radius_km:bd.radius,status:'active'});
      createdBuyers.push({...bd,id:r.id});
    }
    log(`Created ${createdBuyers.length} recycler buyers`);

    // MATERIAL LISTINGS
    const materials=['plastic','paper','metal','glass','organic'];
    const listingBatch=[];
    for(let i=0;i<120;i++){
      const mat=pick(materials);const grade=pick(['A','A','B','B','C']);const qty=rndF(50,2000,1);
      const aDate=dateRange(720,7);const expiry=new Date(aDate.getTime()+rnd(14,60)*86400000);
      const sold=Math.random()>0.4;
      listingBatch.push({tenant_id:TENANT_ID,material:mat,grade,quantity_kg:qty,location_zone_id:pick(allZones).id,available_from:aDate.toISOString(),expires_at:expiry.toISOString(),status:sold?'sold':Math.random()>0.3?'available':'reserved',ai_estimated_price_ugx:mat==='metal'?rnd(1200,1600):mat==='paper'?rnd(700,950):mat==='plastic'?rnd(500,750):mat==='glass'?rnd(300,500):rnd(150,280),waste_bank_agent_id:`agent-${rnd(1,5)}`});
    }
    const listingCount=await safeBulk(base44.asServiceRole.entities.MaterialListing,listingBatch);
    log(`Created ${listingCount} material listings`);

    // RECYCLER OFFERS
    const offerBatch=[];
    for(let i=0;i<90;i++){
      const buyer=pick(createdBuyers);const qty=rndF(50,1500,1);const offerDate=dateRange(700,7);
      const status=pick(['completed','completed','accepted','pending','rejected']);const settled=status==='completed';
      offerBatch.push({tenant_id:TENANT_ID,listing_id:`listing-ref-${rnd(10000,99999)}`,buyer_id:buyer.id,offered_price_per_kg_ugx:buyer.price+rnd(-100,100),quantity_kg:qty,pickup_date:new Date(offerDate.getTime()+rnd(2,10)*86400000).toISOString(),status,settlement_ugx:settled?Math.round(qty*buyer.price):null,settled_at:settled?new Date(offerDate.getTime()+rnd(5,15)*86400000).toISOString():null});
    }
    const offerCount=await safeBulk(base44.asServiceRole.entities.RecyclerOffer,offerBatch);
    log(`Created ${offerCount} recycler offers`);
    await sleep(500);

    // FACILITY YIELD RECORDS (24 months × 2 facilities)
    const facilityIds=['facility-namave-001','facility-kiteezi-001'];
    const yieldBatch=[];
    for(let m=24;m>=1;m--){
      for(const fid of facilityIds){
        const periodDate=daysAgo(m*30);const inbound=rndF(120,850,1);
        const recyclable=rndF(inbound*0.2,inbound*0.45,1);const organic=rndF(inbound*0.15,inbound*0.3,1);
        const residue=parseFloat((inbound-recyclable-organic).toFixed(1));
        const diversion=parseFloat(((1-residue/inbound)*100).toFixed(1));
        const w2e=fid.includes('kiteezi');
        yieldBatch.push({tenant_id:TENANT_ID,facility_id:fid,period:isoDate(periodDate),inbound_t:inbound,sorted_recyclable_t:recyclable,sorted_organic_t:organic,sorted_residue_t:residue,recovered_energy_kwh:w2e?rnd(12000,85000):null,contamination_rate_pct:rndF(2,18,1),diversion_rate_pct:diversion,outbound_shipments_json:JSON.stringify([{material:'plastic',buyer:'Kampala Plastics Recyclers',quantity_kg:Math.round(recyclable*0.45*1000)},{material:'metal',buyer:'Nile Metals Uganda',quantity_kg:Math.round(recyclable*0.2*1000)},{material:'paper',buyer:'UG Paper & Board Ltd',quantity_kg:Math.round(recyclable*0.35*1000)}]),notes:`Monthly yield report. Facility: ${fid}.`});
      }
    }
    const yieldCount=await safeBulk(base44.asServiceRole.entities.FacilityYieldRecord,yieldBatch);
    log(`Created ${yieldCount} facility yield records`);

    // OUTBOUND SHIPMENTS
    const shipBatch=[];
    for(let i=0;i<100;i++){
      const buyer=pick(createdBuyers);const mat=pick(buyer.materials);const qty=rnd(200,8000);const shipDate=dateRange(700,7);
      shipBatch.push({tenant_id:TENANT_ID,facility_id:pick(facilityIds),material:mat,buyer_id:buyer.id,quantity_kg:qty,shipped_at:shipDate.toISOString(),vehicle_id:pick(activeVehs).id,manifest_url:`https://storage.example.com/manifest-${rnd(1000,9999)}.pdf`,settlement_ugx:Math.round(qty*buyer.price)});
    }
    const shipCount=await safeBulk(base44.asServiceRole.entities.OutboundShipment,shipBatch);
    log(`Created ${shipCount} outbound shipments`);
    await sleep(500);

    // CAPACITY PLANS
    const capBatch=[];
    for(let db=90;db>=0;db-=7){
      const planDate=daysAgo(db);
      for(const z of allZones){
        const forecast=rndF(15,120,1);const stops=rnd(30,200);const vehicles=rnd(1,4);const crew=vehicles*2;const capacity=vehicles*6;const utilPct=parseFloat(((forecast/capacity)*100).toFixed(1));
        capBatch.push({tenant_id:TENANT_ID,plan_date:isoDate(planDate),zone_id:z.id,forecast_demand_t:forecast,forecast_stops:stops,available_vehicles:vehicles,available_crew:crew,planned_capacity_t:capacity,utilisation_pct:utilPct,status:utilPct>95?'over':utilPct>80?'tight':'ok',notes:`Weekly capacity plan for zone ${z.zone_name}.`});
      }
    }
    const capCount=await safeBulk(base44.asServiceRole.entities.CapacityPlan,capBatch);
    log(`Created ${capCount} capacity plans`);

    return Response.json({success:true,logs,summary:{maintenanceOrders:mwCount,maintenanceAlerts:maCount,complaints:compCount,tickets:tktCount,surveys:surveyCount,wasteBankTxns:wbCount,inventory:invBatch.length,servicePoints:spBatch.length,containers:containerIds.length,sensorReadings:sensorCount,subcontractors:createdSubs.length,subcontractorJobs:subJobCount,recyclerBuyers:createdBuyers.length,materialListings:listingCount,recyclerOffers:offerCount,facilityYields:yieldCount,outboundShipments:shipCount,capacityPlans:capCount}});
  }catch(error){
    return Response.json({error:error.message,stack:error.stack?.slice(0,600)},{status:500});
  }
});