import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Schema Evolution AI Assistant
 * When a schema migration is proposed, auto-assesses downstream impact,
 * flags breaking changes, and suggests backward-compatible migration paths.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { proposal_id, entity_name, change_type, proposed_change, description } = body;

    if (!entity_name || !change_type || !proposed_change) {
      return Response.json({ error: 'entity_name, change_type and proposed_change are required' }, { status: 400 });
    }

    // Known entity dependency map (canonical schema relationships)
    const entityDependencies = {
      Customer: ['PickupRequest','Invoice','Payment','Receipt','Statement','Contract','ServicePoint','Subscription','CustomerSatisfaction','EvidenceBundle','AuditLog'],
      Invoice: ['Payment','Receipt','Statement','Subscription'],
      PickupRequest: ['Route','EvidenceBundle','CustomerSatisfaction','PredictiveException','AuditLog'],
      Route: ['PickupRequest','EvidenceBundle','ComplianceReport','RouteFeedback','FleetAlert','AuditLog'],
      ServiceZone: ['PickupRequest','Route','Customer','ServicePoint','ServicePlan'],
      Vehicle: ['Route','VehicleTelematics','FleetAlert','FuelLog','MaintenanceWorkOrder'],
      Tenant: ['Customer','ServiceZone','Vehicle','Route','Invoice','AuditLog','RBACRole','TenantHealthAlert'],
      ServicePlan: ['Contract','Subscription','Invoice'],
      Contract: ['Customer','ServicePlan','Invoice'],
      Payment: ['Invoice','Receipt','AuditLog'],
      Statement: ['Invoice','Payment','Receipt'],
    };

    const downstream = entityDependencies[entity_name] || [];

    // AI impact analysis prompt
    const prompt = `You are a senior platform architect analysing a database schema change for NLSWMS, a multi-tenant waste management SaaS platform.

PROPOSED CHANGE:
Entity: ${entity_name}
Change Type: ${change_type}
Details: ${typeof proposed_change === 'object' ? JSON.stringify(proposed_change, null, 2) : proposed_change}
${description ? `Description: ${description}` : ''}

KNOWN DOWNSTREAM DEPENDENCIES for ${entity_name}:
${downstream.length > 0 ? downstream.join(', ') : 'No direct dependencies mapped'}

ALL PLATFORM ENTITIES: Customer, ServicePoint, Contract, PickupRequest, Route, Invoice, Payment, Receipt, Statement, EvidenceBundle, Ticket/Complaint, Tenant, ServiceZone, Vehicle, ServicePlan, Subscription, AuditLog, RBACRole

ANALYSIS REQUIRED:
1. **Breaking Changes** - List any breaking changes this migration introduces (field removals, type changes, required field additions). Mark each as BREAKING or SAFE.
2. **Downstream Impact** - Which dependent entities/queries/reports will be affected and how?
3. **Backward-Compatible Migration Path** - Provide a step-by-step migration strategy that minimises downtime and data loss.
4. **Risk Level** - Assess overall risk: low / medium / high / critical
5. **Rollback Plan** - Brief rollback strategy if the migration fails.

Format your response as JSON with keys: breaking_changes (array of strings), downstream_impact (string), migration_path (string), risk_level (string), rollback_plan (string), summary (string).`;

    const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          breaking_changes: { type: 'array', items: { type: 'string' } },
          downstream_impact: { type: 'string' },
          migration_path: { type: 'string' },
          risk_level: { type: 'string' },
          rollback_plan: { type: 'string' },
          summary: { type: 'string' },
        }
      }
    });

    // Create or update proposal record
    let proposal;
    if (proposal_id) {
      proposal = await base44.asServiceRole.entities.SchemaEvolutionProposal.update(proposal_id, {
        ai_impact_analysis: aiResult.downstream_impact || aiResult.summary,
        breaking_changes: aiResult.breaking_changes || [],
        affected_entities: downstream,
        migration_suggestion: aiResult.migration_path,
        risk_level: aiResult.risk_level || 'medium',
        status: 'ai_analysis_complete',
        proposed_by: user.email,
      });
    } else {
      proposal = await base44.asServiceRole.entities.SchemaEvolutionProposal.create({
        entity_name,
        change_type,
        proposed_change: typeof proposed_change === 'object' ? JSON.stringify(proposed_change) : proposed_change,
        ai_impact_analysis: aiResult.downstream_impact || aiResult.summary,
        breaking_changes: aiResult.breaking_changes || [],
        affected_entities: downstream,
        migration_suggestion: aiResult.migration_path,
        risk_level: aiResult.risk_level || 'medium',
        status: 'ai_analysis_complete',
        proposed_by: user.email,
      });
    }

    return Response.json({
      success: true,
      proposal_id: proposal.id,
      entity_name,
      change_type,
      risk_level: aiResult.risk_level,
      breaking_changes: aiResult.breaking_changes || [],
      downstream_impact: aiResult.downstream_impact,
      migration_path: aiResult.migration_path,
      rollback_plan: aiResult.rollback_plan,
      summary: aiResult.summary,
      affected_entities: downstream,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});