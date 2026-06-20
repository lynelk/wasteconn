/**
 * Seed Phase 2: Invoices + Payments only (runs after seedPhase1)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const TENANT_ID='69e1364b1f13b6504df1acd0';
function rnd(a,b){return Math.floor(Math.random()*(b-a+1))+a;}
function pick(arr){return arr[Math.floor(Math.random()*arr.length)];}
function isoDate(d){return d.toISOString().split('T')[0];}
function daysAgo(n){const d=new Date('2026-06-20T00:00:00Z');d.setDate(d.getDate()-n);return d;}
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

const PLAN_PRICES={res_basic:45000,res_std:65000,res_prem:95000,sme_std:145000,comm_plus:380000,inst_prem:680000,enterprise:1650000,university:2800000};

Deno.serve(async(req)=>{
  try{
    const base44=createClientFromRequest(req);
    const user=await base44.auth.me();
    if(user?.role!=='admin')return Response.json({error:'Admin only'},{status:403});
    const logs=[];
    const log=(m)=>{logs.push(m);console.log('[P2]',m);};

    const allCustomers=await base44.asServiceRole.entities.Customer.list('created_date',200);
    log(`Loaded ${allCustomers.length} customers`);

    const typeTierPlan=(c)=>{
      if(c.customer_type==='industrial')return 'enterprise';
      if(c.customer_type==='commercial'&&c.customer_segment==='institution')return 'inst_prem';
      if(c.customer_type==='commercial'&&c.customer_segment==='sme')return pick(['sme_std','comm_plus']);
      const m={'basic':'res_basic','standard':'res_std','premium':'res_prem','enterprise':'enterprise'};
      return m[c.customer_tier]||'res_basic';
    };

    // Invoices - 100 customers × 10 months = 1000 invoices
    const invoiceBatch=[];
    const paymentBatch=[];
    let invSeq=1001;
    for(const c of allCustomers.slice(0,100)){
      const planKey=typeTierPlan(c);
      const price=PLAN_PRICES[planKey];
      for(let m=10;m>=1;m--){
        const issDate=daysAgo(m*30);
        const dueDate=new Date(issDate);dueDate.setDate(dueDate.getDate()+30);
        const isPaid=m>1||Math.random()>0.3;
        const paidDate=isPaid?new Date(issDate.getTime()+rnd(2,25)*86400000):null;
        const pm=c.mobile_money_provider==='mtn'?'mtn_momo':c.mobile_money_provider==='airtel'?'airtel_money':pick(['cash','bank_transfer']);
        invoiceBatch.push({tenant_id:TENANT_ID,customer_id:c.id,invoice_number:`INV-${issDate.getFullYear()}-${String(invSeq++).padStart(4,'0')}`,amount_ugx:price,status:isPaid?'paid':m===1?'issued':'overdue',issue_date:isoDate(issDate),due_date:isoDate(dueDate),paid_date:paidDate?paidDate.toISOString():null,items:[{description:`${planKey.replace('_',' ')} - ${issDate.toLocaleString('en',{month:'short',year:'numeric'})}`,quantity:1,unit_price_ugx:price,total_ugx:price}]});
        if(isPaid)paymentBatch.push({tenant_id:TENANT_ID,customer_id:c.id,amount_ugx:price,payment_method:pm,status:'completed',payment_date:isoDate(paidDate),transaction_ref:`TXN-${rnd(100000,999999)}`,mobile_money_number:c.mobile_money_number||null,period_from:isoDate(issDate),period_to:isoDate(dueDate),recorded_by:'System'});
      }
    }

    const invCount=await safeBulk(base44.asServiceRole.entities.Invoice,invoiceBatch);
    log(`Created ${invCount} invoices`);
    await sleep(1000);

    const payCount=await safeBulk(base44.asServiceRole.entities.Payment,paymentBatch);
    log(`Created ${payCount} payments`);

    return Response.json({success:true,logs,summary:{invoices:invCount,payments:payCount}});
  }catch(error){
    return Response.json({error:error.message,stack:error.stack?.slice(0,600)},{status:500});
  }
});