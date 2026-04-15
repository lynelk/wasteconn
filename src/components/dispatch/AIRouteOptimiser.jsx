import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Zap, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function AIRouteOptimiser({ jobs, zones, vehicles, selectedDate, onOptimised }) {
  const queryClient = useQueryClient();
  const [result, setResult] = useState(null);

  const optimiseMutation = useMutation({
    mutationFn: async () => {
      const jobSummary = jobs.slice(0, 20).map(j => ({
        id: j.id,
        address: j.address,
        waste_type: j.waste_type,
        zone_id: j.zone_id,
        estimated_weight_kg: j.estimated_weight_kg,
        scheduled_time: j.scheduled_time,
      }));

      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a route optimisation AI for a waste management system in Uganda.
Given these ${jobs.length} unassigned pickup jobs for ${selectedDate}, suggest optimised route groupings.
Consider: zone proximity, waste type compatibility, time windows, vehicle capacity (${vehicles.length} available vehicles).

Jobs: ${JSON.stringify(jobSummary)}
Zones: ${JSON.stringify(zones.map(z => ({ id: z.id, name: z.zone_name, district: z.district })))}

Return 2-4 optimised route groups. For each route provide:
- route_name: descriptive name
- job_ids: array of job IDs in optimal order
- estimated_distance_km: rough estimate
- rationale: brief explanation of grouping logic
- efficiency_score: 0-100`,
        response_json_schema: {
          type: 'object',
          properties: {
            routes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  route_name: { type: 'string' },
                  job_ids: { type: 'array', items: { type: 'string' } },
                  estimated_distance_km: { type: 'number' },
                  rationale: { type: 'string' },
                  efficiency_score: { type: 'number' },
                }
              }
            },
            summary: { type: 'string' }
          }
        }
      });
      return res;
    },
    onSuccess: (data) => setResult(data),
  });

  const applyRoute = async (route) => {
    await base44.entities.Route.create({
      route_name: route.route_name,
      route_date: selectedDate,
      job_ids: route.job_ids,
      estimated_distance_km: route.estimated_distance_km,
      ai_optimised: true,
      ai_optimisation_notes: route.rationale,
      status: 'draft',
      tenant_id: jobs[0]?.tenant_id || '',
      zone_id: jobs[0]?.zone_id || '',
    });
    onOptimised();
    setResult(null);
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold">AI Route Optimiser</p>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Automatically group {jobs.length} unassigned jobs into optimised routes using AI.
        </p>

        {!result ? (
          <Button
            size="sm"
            className="w-full"
            onClick={() => optimiseMutation.mutate()}
            disabled={optimiseMutation.isPending || jobs.length === 0}
          >
            {optimiseMutation.isPending ? (
              <><Loader2 className="w-3 h-3 animate-spin" /> Optimising...</>
            ) : (
              <><Zap className="w-3 h-3" /> Optimise Routes</>
            )}
          </Button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{result.summary}</p>
            {result.routes?.map((route, i) => (
              <div key={i} className="bg-card rounded-lg p-3 border border-border/60">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-medium">{route.route_name}</p>
                  <span className="text-xs text-primary font-bold">{route.efficiency_score}%</span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{route.rationale}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{route.job_ids?.length} jobs · {route.estimated_distance_km} km</span>
                  <button
                    onClick={() => applyRoute(route)}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    Apply
                  </button>
                </div>
              </div>
            ))}
            <button onClick={() => setResult(null)} className="text-xs text-muted-foreground hover:text-foreground w-full text-center pt-1">
              Clear results
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}