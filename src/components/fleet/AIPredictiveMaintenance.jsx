import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Zap, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function AIPredictiveMaintenance({ vehicles, workOrders, fuelLogs }) {
  const queryClient = useQueryClient();
  const [predictions, setPredictions] = useState(null);

  const predictMutation = useMutation({
    mutationFn: async () => {
      const vehicleSummary = vehicles.map(v => ({
        id: v.id,
        reg: v.registration_number,
        type: v.vehicle_type,
        last_service: v.last_service_date,
        next_service: v.next_service_date,
        status: v.status,
        recent_work_orders: workOrders.filter(wo => wo.vehicle_id === v.id).slice(0, 3).map(wo => ({
          type: wo.order_type, priority: wo.priority, title: wo.title, date: wo.scheduled_date,
        })),
        fuel_efficiency: fuelLogs.filter(fl => fl.vehicle_id === v.id).slice(0, 5).map(fl => fl.efficiency_km_per_litre),
      }));

      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a fleet predictive maintenance AI for a Ugandan waste management company.
Analyse these vehicles and their maintenance/fuel history. Identify failure risks and recommend maintenance actions.

Vehicles: ${JSON.stringify(vehicleSummary)}

For each vehicle at risk, provide:
- vehicle_id and reg number
- failure_probability: 0-100 score
- risk_factors: list of reasons
- recommended_action: what to do
- urgency: low/medium/high/critical`,
        response_json_schema: {
          type: 'object',
          properties: {
            alerts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  vehicle_id: { type: 'string' },
                  vehicle_reg: { type: 'string' },
                  failure_probability: { type: 'number' },
                  risk_factors: { type: 'array', items: { type: 'string' } },
                  recommended_action: { type: 'string' },
                  urgency: { type: 'string' },
                }
              }
            },
            fleet_health_score: { type: 'number' },
            summary: { type: 'string' }
          }
        }
      });
      return res;
    },
    onSuccess: (data) => {
      setPredictions(data);
      // Auto-create critical work orders
      data.alerts?.filter(a => a.urgency === 'critical').forEach(async (alert) => {
        await base44.entities.MaintenanceWorkOrder.create({
          vehicle_id: alert.vehicle_id,
          title: `[AI Alert] ${alert.recommended_action}`,
          order_type: 'predictive',
          priority: 'critical',
          ai_prediction_score: alert.failure_probability,
          description: alert.risk_factors?.join(', '),
          status: 'open',
          tenant_id: '',
        });
      });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
    },
  });

  const urgencyColor = { low: 'text-green-600', medium: 'text-yellow-600', high: 'text-orange-600', critical: 'text-red-600' };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold">AI Predictive Maintenance</p>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Analyse {vehicles.length} vehicles for failure risk using maintenance history and fuel efficiency data.
        </p>

        {!predictions ? (
          <Button size="sm" className="w-full" onClick={() => predictMutation.mutate()} disabled={predictMutation.isPending || vehicles.length === 0}>
            {predictMutation.isPending ? (
              <><Loader2 className="w-3 h-3 animate-spin" /> Analysing fleet...</>
            ) : (
              <><Zap className="w-3 h-3" /> Run AI Analysis</>
            )}
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Fleet Health Score</span>
              <span className={`text-sm font-bold ${predictions.fleet_health_score >= 70 ? 'text-green-600' : predictions.fleet_health_score >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                {predictions.fleet_health_score}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{predictions.summary}</p>
            {predictions.alerts?.map((alert, i) => (
              <div key={i} className="bg-card rounded-lg p-3 border border-border/60">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium">{alert.vehicle_reg}</p>
                  <span className={`text-xs font-bold ${urgencyColor[alert.urgency] || 'text-muted-foreground'}`}>
                    {alert.failure_probability}% risk
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-1">{alert.recommended_action}</p>
                <div className="flex flex-wrap gap-1">
                  {alert.risk_factors?.map((f, j) => (
                    <span key={j} className="text-xs bg-muted px-1.5 py-0.5 rounded">{f}</span>
                  ))}
                </div>
              </div>
            ))}
            <button onClick={() => setPredictions(null)} className="text-xs text-muted-foreground hover:text-foreground w-full text-center">Clear</button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}