import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * ML Permission Recommendation Engine
 * Analyses role usage patterns, surfaces least-privilege suggestions,
 * and flags dormant permissions (unused > 30 days) for admin review.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { dormant_days = 30, tenant_id } = body;
    const dormantCutoff = new Date(Date.now() - dormant_days * 24 * 60 * 60 * 1000);

    // Fetch all permission usage records
    const usageRecords = await base44.asServiceRole.entities.RBACPermissionUsage.list('-last_used_at', 500);
    const roles = await base44.asServiceRole.entities.RBACRole.list();

    const dormantUpdates = [];
    const recommendations = [];

    // --- 1. Dormant permission detection ---
    for (const rec of usageRecords) {
      const isDormant = !rec.last_used_at || new Date(rec.last_used_at) < dormantCutoff;
      if (isDormant !== rec.is_dormant) {
        await base44.asServiceRole.entities.RBACPermissionUsage.update(rec.id, {
          is_dormant: isDormant,
          ml_flagged_for_review: isDormant,
        });
        if (isDormant) dormantUpdates.push({ user: rec.user_email, permission: rec.permission, last_used: rec.last_used_at });
      }
    }

    // --- 2. Role usage pattern analysis for least-privilege ---
    // Group by role type
    const roleUsageMap = {};
    for (const rec of usageRecords) {
      const key = rec.role_type || 'unknown';
      if (!roleUsageMap[key]) roleUsageMap[key] = { permissions_used: new Set(), permissions_declared: new Set() };
      if (rec.use_count_30d > 0) roleUsageMap[key].permissions_used.add(rec.permission);
      roleUsageMap[key].permissions_declared.add(rec.permission);
    }

    for (const [roleType, data] of Object.entries(roleUsageMap)) {
      const unusedPerms = [...data.permissions_declared].filter(p => !data.permissions_used.has(p));
      if (unusedPerms.length > 0) {
        const usage_ratio = data.permissions_used.size / Math.max(data.permissions_declared.size, 1);
        const suggestion = `Role '${roleType}' uses ${data.permissions_used.size}/${data.permissions_declared.size} declared permissions. ` +
          `Consider removing: ${unusedPerms.slice(0, 5).join(', ')}${unusedPerms.length > 5 ? ` (+${unusedPerms.length - 5} more)` : ''}.`;

        recommendations.push({
          role_type: roleType,
          total_permissions: data.permissions_declared.size,
          used_permissions: data.permissions_used.size,
          unused_permissions: unusedPerms.length,
          usage_ratio: Math.round(usage_ratio * 100),
          suggestion,
          unused_list: unusedPerms,
        });
      }
    }

    // --- 3. Use AI to generate narrative recommendations ---
    const aiPrompt = `You are a security analyst reviewing RBAC permission usage for a waste management SaaS platform.

Role usage summary (last 30 days):
${recommendations.map(r => `- ${r.role_type}: uses ${r.used_permissions}/${r.total_permissions} permissions (${r.usage_ratio}% utilisation). Unused: ${r.unused_list.slice(0,3).join(', ')}`).join('\n')}

Dormant permissions flagged: ${dormantUpdates.length}

Provide:
1. Top 3 least-privilege recommendations (be specific about which permissions to revoke per role)
2. Security risk assessment if dormant permissions are not revoked
3. Suggested review cadence

Keep response concise, actionable, under 250 words.`;

    let aiAnalysis = '';
    if (recommendations.length > 0 || dormantUpdates.length > 0) {
      const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt: aiPrompt });
      aiAnalysis = typeof aiResult === 'string' ? aiResult : JSON.stringify(aiResult);
    }

    return Response.json({
      success: true,
      dormant_threshold_days: dormant_days,
      dormant_permissions_flagged: dormantUpdates.length,
      dormant_details: dormantUpdates,
      role_recommendations: recommendations,
      ai_analysis: aiAnalysis,
      summary: `Scanned ${usageRecords.length} permission records across ${Object.keys(roleUsageMap).length} role types. Flagged ${dormantUpdates.length} dormant permissions. Generated ${recommendations.length} least-privilege recommendations.`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});