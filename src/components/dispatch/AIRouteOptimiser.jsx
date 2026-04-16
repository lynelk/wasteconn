import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Zap, Loader2, ThumbsUp, ThumbsDown, MessageSquare, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/lib/AuthContext';

// Feedback Modal for a given route after applying
function RouteFeedbackModal({ route, onClose, tenantId, userEmail }) {
  const [rating, setRating] = useState(3);
  const [comments, setComments] = useState('');
  const [type, setType] = useState('neutral');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.RouteFeedback.create({
      tenant_id: tenantId,
      route_id: route.id,
      route_name: route.route_name,
      feedback_type: type,
      efficiency_rating: rating,
      comments,
      estimated_distance_km: route.estimated_distance_km,
      ai_optimised: route.ai_optimised,
      dispatcher_email: userEmail,
    });
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-2xl p-5 w-full max-w-sm shadow-xl border border-border">
        <div className="flex items-center justify-between mb-4">
          <p className="font-semibold text-sm font-jakarta">Rate this Route</p>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">{route.route_name}</p>

        <div className="flex gap-2 mb-4">
          {[
            { val: 'positive', Icon: ThumbsUp, label: 'Good', cls: type === 'positive' ? 'bg-green-100 text-green-700 border-green-300' : '' },
            { val: 'neutral', Icon: MessageSquare, label: 'Okay', cls: type === 'neutral' ? 'bg-blue-100 text-blue-700 border-blue-300' : '' },
            { val: 'negative', Icon: ThumbsDown, label: 'Poor', cls: type === 'negative' ? 'bg-red-100 text-red-700 border-red-300' : '' },
          ].map(({ val, Icon, label, cls }) => (
            <button key={val} onClick={() => setType(val)}
              className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg border text-xs font-medium transition-all ${cls || 'border-border text-muted-foreground hover:border-primary/40'}`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>

        <div className="mb-3">
          <p className="text-xs text-muted-foreground mb-1">Efficiency (1-5): <span className="font-semibold text-foreground">{rating}</span></p>
          <input type="range" min={1} max={5} value={rating} onChange={e => setRating(Number(e.target.value))}
            className="w-full accent-primary" />
        </div>

        <textarea
          className="w-full border border-input bg-background rounded-lg px-3 py-2 text-sm resize-none mb-3"
          rows={2} placeholder="Optional comments..." value={comments}
          onChange={e => setComments(e.target.value)}
        />

        <Button size="sm" className="w-full" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Submit Feedback'}
        </Button>
      </div>
    </div>
  );
}

export default function AIRouteOptimiser({ jobs, zones, vehicles, selectedDate, onOptimised }) {
  const { user } = useAuth();
  const [result, setResult] = useState(null);
  const [feedbackRoute, setFeedbackRoute] = useState(null);

  // Fetch recent historical route data to enrich AI context
  const { data: recentRoutes = [] } = useQuery({
    queryKey: ['recent-routes-history'],
    queryFn: () => base44.entities.Route.list('-route_date', 20),
  });

  // Fetch recent feedback to incorporate into prompt
  const { data: recentFeedback = [] } = useQuery({
    queryKey: ['recent-route-feedback'],
    queryFn: () => base44.entities.RouteFeedback.list('-created_date', 10),
  });

  const optimiseMutation = useMutation({
    mutationFn: async () => {
      const jobSummary = jobs.slice(0, 30).map(j => ({
        id: j.id,
        address: j.address,
        waste_type: j.waste_type,
        zone_id: j.zone_id,
        estimated_weight_kg: j.estimated_weight_kg || 0,
        scheduled_time: j.scheduled_time || 'any',
      }));

      const vehicleSummary = vehicles.map(v => ({
        id: v.id,
        type: v.vehicle_type,
        capacity_tonnes: v.capacity_tonnes || 3,
        registration: v.registration_number,
        status: v.status,
      }));

      // Compute historical performance averages from past routes
      const completedRoutes = recentRoutes.filter(r => r.status === 'completed' && r.actual_distance_km && r.estimated_distance_km);
      const avgDeviation = completedRoutes.length > 0
        ? (completedRoutes.reduce((s, r) => s + Math.abs(r.actual_distance_km - r.estimated_distance_km), 0) / completedRoutes.length).toFixed(1)
        : 'unknown';

      const positiveCount = recentFeedback.filter(f => f.feedback_type === 'positive').length;
      const negativeCount = recentFeedback.filter(f => f.feedback_type === 'negative').length;
      const feedbackSummary = recentFeedback.length > 0
        ? `${positiveCount} positive, ${negativeCount} negative ratings. Sample comments: ${recentFeedback.slice(0, 3).map(f => f.comments).filter(Boolean).join('; ')}`
        : 'No dispatcher feedback yet.';

      const res = await base44.integrations.Core.InvokeLLM({
        model: 'claude_sonnet_4_6',
        prompt: `You are an expert route optimisation AI for a waste management company operating in Uganda (Kampala region).

DATE: ${selectedDate}
CONTEXT: Urban East African road conditions. Average speed in city: 20-30 km/h. Peak hours: 7-9am, 4-7pm (avoid when possible).
Use your knowledge of current Kampala traffic patterns, road conditions, and construction zones to refine route estimates.
Factor in real-world conditions: Kampala Road, Entebbe Road, Jinja Road, and Northern Bypass have distinct traffic characteristics.

VEHICLES AVAILABLE (${vehicles.length}):
${JSON.stringify(vehicleSummary, null, 2)}

Vehicle capacity constraints:
- Tricycle: max 0.5 tonnes, max 8 jobs
- Pickup: max 1 tonne, max 12 jobs
- Truck/Tipper/Compactor: max 3-5 tonnes, 15-25 jobs

Waste type constraints:
- Hazardous waste: MUST be on a separate vehicle, NOT mixed with other types
- Bulky waste: requires truck or tipper, max 5-8 items per load
- Recyclable: can be combined with organic or general
- Time windows: Hazardous pickups before 10am; Commercial zones prefer 6-8am

JOBS TO OPTIMISE (${jobs.length} total):
${JSON.stringify(jobSummary, null, 2)}

ZONES:
${JSON.stringify(zones.map(z => ({ id: z.id, name: z.zone_name, district: z.district, sub_county: z.sub_county })), null, 2)}

HISTORICAL PERFORMANCE:
- Average distance deviation from estimates: ${avgDeviation} km
- Dispatcher feedback: ${feedbackSummary}

INSTRUCTIONS:
1. Group jobs by geographic proximity AND waste type compatibility
2. Respect vehicle capacity limits strictly
3. Avoid mixing hazardous waste with other types
4. Sequence stops to minimise backtracking
5. Factor in time windows for hazardous and commercial pickups
6. Produce 2-4 route groups using available vehicles

For each route provide:
- route_name: descriptive name (e.g. "Zone A Morning Recyclables")
- job_ids: ordered array of job IDs
- estimated_distance_km: realistic estimate accounting for Kampala road conditions
- estimated_duration_mins: realistic time estimate
- recommended_vehicle_type: best vehicle type for this route
- rationale: brief explanation
- efficiency_score: 0-100
- warnings: any issues (e.g. capacity near limit, hazardous mixing)`,
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
                  estimated_duration_mins: { type: 'number' },
                  recommended_vehicle_type: { type: 'string' },
                  rationale: { type: 'string' },
                  efficiency_score: { type: 'number' },
                  warnings: { type: 'string' },
                }
              }
            },
            summary: { type: 'string' },
            total_coverage_pct: { type: 'number' },
          }
        }
      });
      return res;
    },
    onSuccess: (data) => setResult(data),
  });

  const applyRoute = async (route) => {
    const created = await base44.entities.Route.create({
      route_name: route.route_name,
      route_date: selectedDate,
      job_ids: route.job_ids,
      estimated_distance_km: route.estimated_distance_km,
      estimated_duration_mins: route.estimated_duration_mins,
      ai_optimised: true,
      ai_optimisation_notes: route.rationale,
      status: 'draft',
      tenant_id: jobs[0]?.tenant_id || '',
      zone_id: jobs[0]?.zone_id || '',
    });
    onOptimised();
    setFeedbackRoute({ ...route, id: created.id });
    setResult(null);
  };

  const scoreColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-500';
  };

  return (
    <>
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold">AI Route Optimiser</p>
            <span className="text-[10px] text-muted-foreground ml-auto">claude_sonnet_4_6</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Automatically group {jobs.length} unassigned jobs into optimised routes using advanced AI with historical context.
          </p>

          {!result ? (
            <Button
              size="sm"
              className="w-full"
              onClick={() => optimiseMutation.mutate()}
              disabled={optimiseMutation.isPending || jobs.length === 0}
            >
              {optimiseMutation.isPending ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> Optimising with AI...</>
              ) : (
                <><Zap className="w-3 h-3" /> Optimise Routes</>
              )}
            </Button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{result.summary}</p>
              {result.total_coverage_pct != null && (
                <p className="text-xs text-primary font-medium">Coverage: {result.total_coverage_pct}% of jobs</p>
              )}
              {result.routes?.map((route, i) => (
                <div key={i} className="bg-card rounded-lg p-3 border border-border/60">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-medium">{route.route_name}</p>
                    <span className={`text-xs font-bold ${scoreColor(route.efficiency_score)}`}>{route.efficiency_score}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">{route.rationale}</p>
                  {route.warnings && (
                    <p className="text-xs text-yellow-600 bg-yellow-50 rounded px-2 py-1 mb-2">⚠ {route.warnings}</p>
                  )}
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-2">
                    <span>{route.job_ids?.length} jobs</span>
                    <span>·</span>
                    <span>{route.estimated_distance_km} km</span>
                    {route.estimated_duration_mins && <><span>·</span><span>~{route.estimated_duration_mins} min</span></>}
                    {route.recommended_vehicle_type && <><span>·</span><span className="capitalize">{route.recommended_vehicle_type}</span></>}
                  </div>
                  <button
                    onClick={() => applyRoute(route)}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    Apply Route →
                  </button>
                </div>
              ))}
              <button onClick={() => setResult(null)} className="text-xs text-muted-foreground hover:text-foreground w-full text-center pt-1">
                Clear results
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {feedbackRoute && (
        <RouteFeedbackModal
          route={feedbackRoute}
          tenantId={jobs[0]?.tenant_id || ''}
          userEmail={user?.email || ''}
          onClose={() => setFeedbackRoute(null)}
        />
      )}
    </>
  );
}