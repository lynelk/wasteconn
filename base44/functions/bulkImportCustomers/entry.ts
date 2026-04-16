import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Bulk Customer Import with Validation + Duplicate Detection
// Accepts an array of customer rows parsed from CSV
// Returns: created, skipped, errors per row

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

function nameSim(a, b) {
  if (!a || !b) return 0;
  const na = a.toLowerCase().trim(), nb = b.toLowerCase().trim();
  if (na === nb) return 1;
  const ml = Math.max(na.length, nb.length);
  return ml === 0 ? 1 : 1 - levenshtein(na, nb) / ml;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { rows, tenant_id, skip_duplicates = true } = body;

    if (!rows || !Array.isArray(rows)) return Response.json({ error: 'rows array is required' }, { status: 400 });

    const existingCustomers = await base44.asServiceRole.entities.Customer.list();

    const results = [];
    let createdCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      // Required field validation
      const validationErrors = [];
      if (!row.full_name || row.full_name.trim().length < 2) validationErrors.push('full_name is required (min 2 chars)');
      if (!row.phone || row.phone.trim().length < 9) validationErrors.push('phone is required (min 9 digits)');
      if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) validationErrors.push('email format invalid');

      if (validationErrors.length > 0) {
        results.push({ row: rowNum, full_name: row.full_name, status: 'error', errors: validationErrors });
        errorCount++;
        continue;
      }

      // Duplicate detection
      let bestDuplicate = null;
      let bestScore = 0;
      for (const ex of existingCustomers) {
        let score = 0;
        const reasons = [];
        if (row.phone && ex.phone && row.phone.replace(/\s/g,'') === ex.phone.replace(/\s/g,'')) { score += 70; reasons.push('Same phone'); }
        if (row.email && ex.email && row.email.toLowerCase() === ex.email.toLowerCase()) { score += 60; reasons.push('Same email'); }
        const ns = nameSim(row.full_name, ex.full_name);
        if (ns >= 0.85) { score += Math.round(ns * 40); reasons.push(`Name similarity ${Math.round(ns*100)}%`); }
        if (score > bestScore) { bestScore = score; bestDuplicate = { customer_id: ex.id, full_name: ex.full_name, score, reasons }; }
      }

      if (bestDuplicate && bestScore >= 60) {
        if (skip_duplicates) {
          results.push({ row: rowNum, full_name: row.full_name, status: 'skipped', reason: 'Duplicate detected', duplicate: bestDuplicate });
          skippedCount++;
          continue;
        }
      }

      // Tier classification
      let tier = 'basic';
      const seg = (row.customer_segment || 'individual').toLowerCase();
      const bins = parseInt(row.bin_count) || 1;
      const waste = parseFloat(row.estimated_waste_kg_month) || 0;
      if (seg === 'institution' || parseInt(row.num_branches) > 3 || waste > 500) tier = 'enterprise';
      else if (seg === 'sme' || row.customer_type === 'commercial' || waste > 200) tier = 'premium';
      else if (bins > 2 || waste > 100) tier = 'standard';

      // Build customer record
      const record = {
        tenant_id: tenant_id || row.tenant_id || '',
        full_name: row.full_name.trim(),
        phone: row.phone.trim(),
        email: row.email?.trim() || '',
        customer_type: ['residential','commercial','industrial'].includes(row.customer_type) ? row.customer_type : 'residential',
        customer_segment: ['individual','sme','institution'].includes(seg) ? seg : 'individual',
        customer_tier: tier,
        tier_auto_classified: true,
        address: row.address?.trim() || '',
        district: row.district?.trim() || '',
        zone_id: row.zone_id || '',
        status: 'active',
        bin_count: bins,
        estimated_waste_kg_month: waste || null,
        num_branches: parseInt(row.num_branches) || 1,
        institution_name: row.institution_name?.trim() || '',
        contact_person: row.contact_person?.trim() || '',
        mobile_money_provider: ['mtn','airtel'].includes(row.mobile_money_provider) ? row.mobile_money_provider : 'none',
        mobile_money_number: row.mobile_money_number?.trim() || '',
        preferred_language: ['english','luganda','swahili'].includes(row.preferred_language) ? row.preferred_language : 'english',
        onboarding_source: 'bulk_import',
        notes: row.notes?.trim() || '',
      };

      try {
        const created = await base44.asServiceRole.entities.Customer.create(record);
        // Add to local cache to detect intra-batch duplicates
        existingCustomers.push({ ...record, id: created.id });
        results.push({ row: rowNum, full_name: row.full_name, status: 'created', customer_id: created.id, tier_assigned: tier, duplicate_warning: bestDuplicate && bestScore >= 40 ? bestDuplicate : null });
        createdCount++;
      } catch (err) {
        results.push({ row: rowNum, full_name: row.full_name, status: 'error', errors: [err.message] });
        errorCount++;
      }
    }

    return Response.json({
      success: true,
      summary: { total: rows.length, created: createdCount, skipped: skippedCount, errors: errorCount },
      results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});