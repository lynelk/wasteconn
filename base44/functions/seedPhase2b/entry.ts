/**
 * Seed Phase 2b: Pickup Requests, Routes, Fuel Logs
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const TENANT_ID='69e1364b1f13b6504df1acd0';
const FACILITY='Namave Industrial Park, Mukono Road';

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
      catch(e){if(e.message?.includes('Rate limit')||e.message?.includes('429')){att++;await sleep(4000*att);}else throw e;}
    }
    await sleep(600);
  }
  return created;
}

const DRIVERS=['DRV-001','DRV-002','DRV-003','DRV-004','DRV-005','DRV-006','DRV-007','DRV-008'];

Deno.serve(async(req)=>{
  try{
    const base44=createClientFromRequest(req);
    const user=await base44.auth.me();
    if(user?.role!=='admin')return Response.json({error:'Admin only'},{status:403});
    const logs=[];
    const log=(m)=>{logs.push(m);console.log('[P2b]',m);};

    const allCustomers=await base44.asServiceRole.entities.Customer.list('created_date',200);
    const allVehicles=await base44.asServiceRole.entities.Vehicle.list();
    const allZones=await base44.asServiceRole.entities.ServiceZone.list();
    const activeVehs=allVehicles.filter(v=>v.status!=='maintenance');
    log(`Loaded ${allCustomers.length} customers, ${activeVehs.length} active vehicles`);

    // PICKUP REQUESTS - 5-10 per customer
    const pickupBatch=[];
    for(const c of allCustomers){
      const n=c.customer_segment==='institution'?rnd(8,12):c.customer_segment==='sme'?rnd(5,8):rnd(4,7);
      for(let i=0;i<n;i++){
        const pd=dateRange(730,1);const st=Math.random()<0.85?'completed':Math.random()<0.7?'cancelled':'pending';
        const veh=pick(activeVehs);const drv=pick(DRIVERS);const dur=rnd(25,140);
        const started=new Date(pd);started.setHours(rnd(6,9),rnd(0,45));
        const completed=new Date(started.getTime()+dur*60000);
        const wt=c.customer_type==='industrial'?rnd(500,7000):c.customer_type==='commercial'?rnd(50,700):rnd(10,75);
        pickupBatch.push({tenant_id:TENANT_ID,customer_id:c.id,zone_id:c.zone_id,request_type:'scheduled',status:st,scheduled_date:isoDate(pd),scheduled_time:`0${rnd(6,9)}:00`,assigned_driver_id:drv,assigned_vehicle_id:veh.id,waste_type:pick(['general','general','recyclable','organic']),actual_weight_kg:st==='completed'?wt:null,address:c.address,latitude:c.latitude,longitude:c.longitude,job_started_at:st==='completed'?started.toISOString():null,completed_at:st==='completed'?completed.toISOString():null,actual_duration_mins:st==='completed'?dur:null,route_distance_km:st==='completed'?rndF(3,30,1):null,source:'internal',service_category:'standard',billing_status:st==='completed'?'invoiced':'none',sla_breach_flagged:Math.random()<0.04,driver_route_feedback:st==='completed'?pick(['preferred','neutral','suboptimal']):null,photo_urls:st==='completed'?[`https://storage.example.com/p${rnd(1000,9999)}.jpg`]:[],evidence_quality_score:st==='completed'?rnd(65,100):null,cv_bin_present:st==='completed'?Math.random()>0.08:null,cv_flagged_for_review:Math.random()<0.03});
      }
    }
    const pickupCount=await safeBulk(base44.asServiceRole.entities.PickupRequest,pickupBatch);
    log(`Created ${pickupCount} pickup requests`);
    await sleep(800);

    // ROUTES - every 2 days for 2 years
    const routeDefs=activeVehs.slice(0,Math.min(6,activeVehs.length)).map((v,i)=>({name:`Zone Route ${i+1}`,zone:allZones[i%allZones.length]?.id,drv:DRIVERS[i],veh:v.id}));
    const routeBatch=[];
    for(let db=730;db>=0;db-=2){
      const rt=pick(routeDefs);if(!rt.zone)continue;
      const rDate=daysAgo(db);const estDist=rndF(12,35,1);const estDur=rnd(90,210);
      const done=db>0;const actDist=done?rndF(estDist*0.85,estDist*1.2,1):null;const actDur=done?rnd(estDur-30,estDur+60):null;
      const started=done?new Date(new Date(rDate).setHours(6,rnd(0,30))):null;
      const completedR=done&&actDur?new Date(started.getTime()+actDur*60000):null;
      routeBatch.push({tenant_id:TENANT_ID,zone_id:rt.zone,vehicle_id:rt.veh,driver_id:rt.drv,route_date:isoDate(rDate),route_name:`${rt.name} - ${isoDate(rDate)}`,status:db===0?'published':db<3?'in_progress':'completed',estimated_distance_km:estDist,estimated_duration_mins:estDur,actual_distance_km:actDist,actual_duration_mins:actDur,started_at:started?.toISOString()||null,completed_at:completedR?.toISOString()||null,fuel_cost_ugx:done?rnd(45000,180000):null,ai_optimised:Math.random()>0.45,ai_optimisation_notes:Math.random()>0.5?`Route optimised. Drop-off: ${FACILITY}`:null,path_input_method:pick(['drawn','manual','imported']),notes:`Waste transported to ${FACILITY}`});
    }
    const routeCount=await safeBulk(base44.asServiceRole.entities.Route,routeBatch);
    log(`Created ${routeCount} routes`);
    await sleep(500);

    // FUEL LOGS - 24 months per vehicle
    const fuelBatch=[];
    for(const v of allVehicles){
      for(let m=24;m>=1;m--){
        const fd=daysAgo(m*30+rnd(0,15));
        fuelBatch.push({tenant_id:TENANT_ID,vehicle_id:v.id,driver_id:pick(DRIVERS),fuel_date:isoDate(fd),litres:rndF(40,120,1),cost_ugx:rnd(180000,600000),odometer_km:50000+(24-m)*rnd(800,1800),fuel_type:'diesel',station_name:pick(['Total Energies Kampala Rd','Shell Jinja Rd','Vivo Nakawa','Total Entebbe Rd','Shell Gulu Main']),efficiency_km_per_litre:rndF(4.5,9.5,2)});
      }
    }
    const fuelCount=await safeBulk(base44.asServiceRole.entities.FuelLog,fuelBatch);
    log(`Created ${fuelCount} fuel logs`);

    return Response.json({success:true,logs,summary:{pickups:pickupCount,routes:routeCount,fuelLogs:fuelCount}});
  }catch(error){
    return Response.json({error:error.message,stack:error.stack?.slice(0,600)},{status:500});
  }
});