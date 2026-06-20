import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Map waste_type values to EPR material categories
const WASTE_TO_MATERIAL = {
  recyclable: 'plastic',
  organic: 'organic',
  general: 'mixed',
  hazardous: 'e_waste',
  bulky: 'mixed',
  glass: 'glass',
  paper: 'paper',
  metal: 'metal',
  plastic: 'plastic',
  textile: 'textile'
};

Deno.serve(async (req) => {
  const secret = req.headers.get('x-epr-secret');
  if (secret !== Deno.env.get('EPR_SECRET') && Deno.env.get('EPR_SECRET')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const base44 = createClientFromRequest(req);

  // Get all WasteBankTransactions not yet attributed
  const transactions = await base44.asServiceRole.entities.WasteBankTransaction.filter({
    status: 'completed'
  }, '-created_date', 500);

  // Get existing attribution refs
  const existingRecs = await base44.asServiceRole.entities.MaterialRecoveryRecord.filter(
    { attributed: true }, '-created_date', 1000
  );
  const existingRefs = new Set(existingRecs.map(r => r.source_ref).filter(Boolean));

  const producers = await base44.asServiceRole.entities.Producer.filter({ active: true });

  let created = 0;
  let ambiguous = 0;
  let skipped = 0;

  for (const tx of transactions) {
    if (existingRefs.has(tx.id)) { skipped++; continue; }

    const wasteType = tx.waste_type || 'general';
    const material = WASTE_TO_MATERIAL[wasteType] || 'mixed';

    // Find producers that handle this material
    const matched = producers.filter(p =>
      Array.isArray(p.materials) && p.materials.includes(material)
    );

    let producerId = null;
    let attributed = false;

    if (matched.length === 1) {
      producerId = matched[0].id;
      attributed = true;
    } else if (matched.length > 1) {
      // Log ambiguous for review
      ambiguous++;
      await base44.asServiceRole.entities.AuditLog.create({
        tenant_id: tx.tenant_id || 'unknown',
        user_id: 'system',
        user_email: 'system@wasteconn.io',
        event_type: 'data_delete',
        entity_type: 'WasteBankTransaction',
        entity_id: tx.id,
        new_value: JSON.stringify({ issue: 'ambiguous_epr_attribution', matched_producers: matched.map(p => p.id), material }),
        notes: 'Multiple producers matched for EPR attribution — manual review required'
      });
    }

    await base44.asServiceRole.entities.MaterialRecoveryRecord.create({
      tenant_id: tx.tenant_id || 'unknown',
      producer_id: producerId,
      source_type: 'waste_bank',
      source_ref: tx.id,
      material,
      grade: 'B',
      weight_kg: tx.weight_kg || 0,
      recovery_date: (tx.transaction_date || new Date().toISOString()).split('T')[0],
      attributed
    });
    created++;
  }

  return Response.json({ ok: true, created, ambiguous, skipped });
});