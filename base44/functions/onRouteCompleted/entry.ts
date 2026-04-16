import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Triggered by entity automation when Route status → completed
// Calculates billing per waste type / volume / distance and creates Invoice

const WASTE_RATE_PER_KG = {
  general: 500,
  recyclable: 400,
  organic: 350,
  hazardous: 1500,
  bulky: 800,
};
const DISTANCE_RATE_PER_KM = 1200; // UGX per km

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const routeId = body?.data?.id || body?.event?.entity_id;
    if (!routeId) return Response.json({ error: 'No route id' }, { status: 400 });

    const route = await base44.asServiceRole.entities.Route.get(routeId);
    if (!route || route.status !== 'completed') {
      return Response.json({ skipped: true, reason: 'Route not completed' });
    }

    const jobIds = route.job_ids || [];
    if (jobIds.length === 0) return Response.json({ skipped: true, reason: 'No jobs on route' });

    // Fetch all jobs on this route
    const allJobs = await base44.asServiceRole.entities.PickupRequest.list();
    const routeJobs = allJobs.filter(j => jobIds.includes(j.id));

    // Group by customer for invoicing
    const byCustomer = {};
    for (const job of routeJobs) {
      if (!job.customer_id) continue;
      if (!byCustomer[job.customer_id]) {
        byCustomer[job.customer_id] = { jobs: [], totalAmount: 0, tenantId: job.tenant_id };
      }
      const weightKg = job.actual_weight_kg || job.estimated_weight_kg || 0;
      const wasteRate = WASTE_RATE_PER_KG[job.waste_type] || WASTE_RATE_PER_KG.general;
      const jobCost = weightKg * wasteRate;
      byCustomer[job.customer_id].jobs.push({ job, jobCost, weightKg });
      byCustomer[job.customer_id].totalAmount += jobCost;
    }

    // Distance cost split equally among customers
    const distanceCost = (route.actual_distance_km || route.estimated_distance_km || 0) * DISTANCE_RATE_PER_KM;
    const customerCount = Object.keys(byCustomer).length;
    const distanceSplit = customerCount > 0 ? distanceCost / customerCount : 0;

    const created = [];
    for (const [customerId, data] of Object.entries(byCustomer)) {
      const totalAmount = Math.round(data.totalAmount + distanceSplit);
      const invoiceNumber = `INV-${Date.now()}-${customerId.slice(0, 6).toUpperCase()}`;
      const items = data.jobs.map(({ job, jobCost, weightKg }) => ({
        description: `${job.waste_type} waste collection – ${weightKg}kg`,
        quantity: weightKg,
        unit_price_ugx: WASTE_RATE_PER_KG[job.waste_type] || WASTE_RATE_PER_KG.general,
        total_ugx: Math.round(jobCost),
      }));
      items.push({
        description: `Route distance contribution (${route.actual_distance_km || route.estimated_distance_km || 0} km ÷ ${customerCount} customers)`,
        quantity: 1,
        unit_price_ugx: Math.round(distanceSplit),
        total_ugx: Math.round(distanceSplit),
      });

      const today = new Date().toISOString().split('T')[0];
      const dueDate = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

      const invoice = await base44.asServiceRole.entities.Invoice.create({
        tenant_id: data.tenantId || route.tenant_id,
        customer_id: customerId,
        invoice_number: invoiceNumber,
        amount_ugx: totalAmount,
        status: 'issued',
        issue_date: today,
        due_date: dueDate,
        items,
        notes: `Auto-generated for route ${route.route_name || routeId} completed on ${today}`,
      });
      created.push(invoice.id);
    }

    return Response.json({ success: true, invoicesCreated: created.length, routeId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});