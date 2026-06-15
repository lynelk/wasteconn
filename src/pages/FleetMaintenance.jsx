import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Fuel, Plus, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import WorkOrderForm from '@/components/fleet/WorkOrderForm';
import FuelLogForm from '@/components/fleet/FuelLogForm';
import AIPredictiveMaintenance from '@/components/fleet/AIPredictiveMaintenance';

const priorityColor = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

const statusColor = {
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

export default function FleetMaintenance() {
  const queryClient = useQueryClient();
  const [showWOForm, setShowWOForm] = useState(false);
  const [showFuelForm, setShowFuelForm] = useState(false);
  const [editingWO, setEditingWO] = useState(null);

  const { data: workOrders = [], isLoading: loadingWO } = useQuery({
    queryKey: ['work-orders'],
    queryFn: () => base44.entities.MaintenanceWorkOrder.list('-created_date', 100),
  });

  const { data: fuelLogs = [], isLoading: loadingFuel } = useQuery({
    queryKey: ['fuel-logs'],
    queryFn: () => base44.entities.FuelLog.list('-fuel_date', 100),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const updateWOMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.MaintenanceWorkOrder.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['work-orders'] }),
  });

  const openWOs = workOrders.filter(w => w.status === 'open').length;
  const criticalWOs = workOrders.filter(w => w.priority === 'critical').length;
  const totalFuelCost = fuelLogs.reduce((s, f) => s + (f.cost_ugx || 0), 0);

  const getVehicleReg = (id) => vehicles.find(v => v.id === id)?.registration_number || id?.slice(0,8) || '—';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-jakarta">Fleet Maintenance</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Work orders, fuel tracking, and predictive AI alerts</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowFuelForm(true)}>
            <Fuel className="w-4 h-4" /> Log Fuel
          </Button>
          <Button size="sm" onClick={() => { setEditingWO(null); setShowWOForm(true); }}>
            <Plus className="w-4 h-4" /> New Work Order
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border/60"><CardContent className="pt-5 pb-4">
          <div className="text-2xl font-bold font-jakarta">{openWOs}</div>
          <p className="text-xs text-muted-foreground mt-1">Open Work Orders</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="pt-5 pb-4">
          <div className="text-2xl font-bold font-jakarta text-red-600">{criticalWOs}</div>
          <p className="text-xs text-muted-foreground mt-1">Critical Priority</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="pt-5 pb-4">
          <div className="text-2xl font-bold font-jakarta">{fuelLogs.length}</div>
          <p className="text-xs text-muted-foreground mt-1">Fuel Entries</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="pt-5 pb-4">
          <div className="text-lg font-bold font-jakarta">UGX {totalFuelCost.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground mt-1">Total Fuel Cost</p>
        </CardContent></Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Tabs defaultValue="workorders">
            <TabsList className="mb-4">
              <TabsTrigger value="workorders">Work Orders ({workOrders.length})</TabsTrigger>
              <TabsTrigger value="fuel">Fuel Log ({fuelLogs.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="workorders">
              {loadingWO ? (
                <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}</div>
              ) : workOrders.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm border border-dashed rounded-xl">No work orders yet.</div>
              ) : (
                <div className="space-y-3">
                  {workOrders.map(wo => (
                    <Card key={wo.id} className="border-border/60">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <Badge className={`text-xs ${priorityColor[wo.priority]}`} variant="secondary">{wo.priority}</Badge>
                              <Badge className={`text-xs ${statusColor[wo.status]}`} variant="secondary">{wo.status?.replace('_',' ')}</Badge>
                              <span className="text-xs text-muted-foreground capitalize">{wo.order_type}</span>
                            </div>
                            <p className="font-medium text-sm truncate">{wo.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Vehicle: {getVehicleReg(wo.vehicle_id)}</p>
                            {wo.ai_prediction_score != null && (
                              <p className="text-xs text-primary mt-0.5 flex items-center gap-1">
                                <Zap className="w-3 h-3" /> AI failure risk: {wo.ai_prediction_score}%
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col gap-1.5 shrink-0">
                            {wo.status === 'open' && (
                              <button
                                onClick={() => updateWOMutation.mutate({ id: wo.id, data: { status: 'in_progress' } })}
                                className="text-xs text-blue-600 hover:underline"
                              >Start</button>
                            )}
                            {wo.status === 'in_progress' && (
                              <button
                                onClick={() => updateWOMutation.mutate({ id: wo.id, data: { status: 'completed', completed_date: format(new Date(), 'yyyy-MM-dd') } })}
                                className="text-xs text-green-600 hover:underline"
                              >Complete</button>
                            )}
                            <button
                              onClick={() => { setEditingWO(wo); setShowWOForm(true); }}
                              className="text-xs text-muted-foreground hover:text-foreground"
                            >Edit</button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="fuel">
              {loadingFuel ? (
                <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />)}</div>
              ) : fuelLogs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm border border-dashed rounded-xl">No fuel logs yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60">
                        <th className="text-left text-xs text-muted-foreground pb-2">Date</th>
                        <th className="text-left text-xs text-muted-foreground pb-2">Vehicle</th>
                        <th className="text-left text-xs text-muted-foreground pb-2">Litres</th>
                        <th className="text-left text-xs text-muted-foreground pb-2">Cost (UGX)</th>
                        <th className="text-left text-xs text-muted-foreground pb-2">km/L</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {fuelLogs.map(log => (
                        <tr key={log.id}>
                          <td className="py-2 text-xs">{log.fuel_date}</td>
                          <td className="py-2 text-xs">{getVehicleReg(log.vehicle_id)}</td>
                          <td className="py-2 text-xs">{log.litres}L</td>
                          <td className="py-2 text-xs">{(log.cost_ugx || 0).toLocaleString()}</td>
                          <td className="py-2 text-xs">{log.efficiency_km_per_litre || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* AI Predictive Panel */}
        <AIPredictiveMaintenance vehicles={vehicles} workOrders={workOrders} fuelLogs={fuelLogs} />
      </div>

      {showWOForm && (
        <WorkOrderForm
          workOrder={editingWO}
          vehicles={vehicles}
          onClose={() => { setShowWOForm(false); setEditingWO(null); }}
          onSaved={() => { queryClient.invalidateQueries({ queryKey: ['work-orders'] }); setShowWOForm(false); setEditingWO(null); }}
        />
      )}
      {showFuelForm && (
        <FuelLogForm
          vehicles={vehicles}
          onClose={() => setShowFuelForm(false)}
          onSaved={() => { queryClient.invalidateQueries({ queryKey: ['fuel-logs'] }); setShowFuelForm(false); }}
        />
      )}
    </div>
  );
}