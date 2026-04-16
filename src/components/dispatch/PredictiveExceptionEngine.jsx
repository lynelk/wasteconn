import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, Loader2, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function PredictiveExceptionEngine({ jobs, selectedDate, onAnalysisComplete }) {
  const queryClient = useQueryClient();
  const [summary, setSummary] = useState(null);

  const analysisMutation = useMutation({
    mutationFn: async () => {
      if (jobs.length === 0) return { exceptions: [], summary: 'No jobs to analyse.' };

      // Build context: recent completion rates by zone
      const jobsForAnalysis = jobs.slice(0, 30).map(j => ({
        id: j.id,
        address: j.address,
        waste_type: j.waste_type,
        zone_id: j.zone_id,
        scheduled_time: j.scheduled_time,
        estimated_weight_kg: j.estimated_weight_kg,
        request_type: j.request_type,
      }));

      const res = await base44.integrations.Core.InvokeLLM({
        model: 'claude_sonnet_4_6',
        prompt: `You are a predictive operations AI for a waste management company in Uganda.

Analyse these ${jobs.length} upcoming pickup jobs scheduled for ${selectedDate} and identify which ones are at HIGH RISK of being delayed or missed.

Risk factors to consider:
- Hazardous waste pickups with no scheduled_time (unplanned = risky)
- Bulky waste in dense urban zones (slow loading)
- Multiple jobs in same area without route planning (no assigned_driver_id = unassigned risk)
- Early morning time windows (before 7am) that may be hard to meet
- Jobs with very high estimated_weight_kg that may exceed capacity
- Request type "bulk" inherently takes longer

JOBS:
${JSON.stringify(jobsForAnalysis, null, 2)}

For each HIGH RISK job (risk_score >= 60), output a prediction.
Skip jobs with low risk (< 60). Focus on the top 5 highest-risk jobs maximum.

Be specific about WHY each job is risky and provide actionable mitigation.`,
        response_json_schema: {
          type: 'object',
          properties: {
            exceptions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  pickup_request_id: { type: 'string' },
                  prediction_type: { type: 'string' },
                  risk_score: { type: 'number' },
                  confidence_score: { type: 'number' },
                  reason: { type: 'string' },
                  mitigation_suggestion: { type: 'string' },
                }
              }
            },
            summary: { type: 'string' },
          }
        }
      });

      // Persist predictions to the database
      const tenantId = jobs[0]?.tenant_id || '';
      if (res.exceptions?.length > 0) {
        for (const ex of res.exceptions) {
          if (!ex.pickup_request_id) continue;
          await base44.entities.PredictiveException.create({
            tenant_id: tenantId,
            pickup_request_id: ex.pickup_request_id,
            prediction_date: selectedDate,
            prediction_type: ex.prediction_type || 'delay',
            risk_score: ex.risk_score,
            confidence_score: ex.confidence_score || 70,
            reason: ex.reason,
            mitigation_suggestion: ex.mitigation_suggestion,
            status: 'predicted',
          });
        }
      }

      return res;
    },
    onSuccess: (data) => {
      setSummary(data.summary);
      queryClient.invalidateQueries({ queryKey: ['predictive-exceptions'] });
      onAnalysisComplete?.();
    },
  });

  return (
    <Card className="border-yellow-400/30 bg-yellow-50/50 dark:bg-yellow-950/20">
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 mb-1">
          <Brain className="w-4 h-4 text-yellow-600" />
          <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-400">Predictive Exception Engine</p>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Scan today's {jobs.length} jobs for delay or missed-pickup risks using AI.
        </p>

        {summary && (
          <p className="text-xs text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/40 rounded-lg px-3 py-2 mb-3">{summary}</p>
        )}

        <Button
          size="sm"
          variant="outline"
          className="w-full border-yellow-400/50 text-yellow-700 hover:bg-yellow-100 dark:text-yellow-400"
          onClick={() => analysisMutation.mutate()}
          disabled={analysisMutation.isPending || jobs.length === 0}
        >
          {analysisMutation.isPending ? (
            <><Loader2 className="w-3 h-3 animate-spin" /> Analysing risks...</>
          ) : (
            <><AlertTriangle className="w-3 h-3" /> Run Risk Analysis</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}