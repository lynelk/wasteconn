import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Wrench, CheckCircle } from 'lucide-react';

export default function MaintenanceAlertsPanel({ vehicles }) {
  const { data: alerts = [] } = useQuery({
    queryKey: ['maintenance-alerts'],
    queryFn: () => base44.entities.MaintenanceAlert.list('-created_date', 50),
  });

  const { data: workOrders = [] } = useQuery({
    queryKey: ['work-orders'],
    queryFn: () => base44.entities.MaintenanceWorkOrder.list('-created_date', 50),
  });

  const severityColor = {
    info: 'bg-blue-100 text-blue-700',
    warning: 'bg-yellow-100 text-yellow-700',
    critical: 'bg-red-100 text-red-700',
  };

  const statusColor = {
    open: 'bg-blue-100 text-blue-700',
    scheduled: 'bg-purple-100 text-purple-700',
    resolved: 'bg-green-100 text-green-700',
  };

  const getVehicleReg = (id) => vehicles.find(v => v.id === id)?.registration_number || id?.slice(0, 8) || '—';

  const openAlerts = alerts.filter(a => a.status === 'open');
  const criticalAlerts = alerts.filter(a => a.severity === 'critical' && a.status !== 'resolved');

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <Card className="border-border/60">
          <CardContent className="pt-5 pb-4">
            <div className="text-2xl font-bold font-jakarta">{openAlerts.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Open Alerts</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="pt-5 pb-4">
            <div className="text-2xl font-bold font-jakarta text-red-600">{criticalAlerts.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Critical</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="pt-5 pb-4">
            <div className="text-2xl font-bold font-jakarta">{workOrders.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Active Work Orders</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        {alerts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm border border-dashed rounded-xl">
            No maintenance alerts
          </div>
        ) : (
          alerts.map(alert => (
            <Card key={alert.id} className="border-border/60">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                      alert.severity === 'critical' ? 'bg-red-100' : alert.severity === 'warning' ? 'bg-yellow-100' : 'bg-blue-100'
                    }`}>
                      <AlertTriangle className={`w-4 h-4 ${
                        alert.severity === 'critical' ? 'text-red-600' : alert.severity === 'warning' ? 'text-yellow-600' : 'text-blue-600'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge className={`text-xs ${severityColor[alert.severity]}`} variant="secondary">
                          {alert.severity}
                        </Badge>
                        <Badge className={`text-xs ${statusColor[alert.status]}`} variant="secondary">
                          {alert.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{alert.alert_type?.replace('_', ' ')}</span>
                      </div>
                      <p className="font-medium text-sm">{alert.description || alert.fault_code}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Vehicle: {getVehicleReg(alert.vehicle_id)}
                        {alert.predicted_service_date && ` · Service due: ${alert.predicted_service_date}`}
                      </p>
                      {alert.ai_recommended_action && (
                        <div className="flex items-center gap-2 mt-2 text-xs text-primary">
                          <Wrench className="w-3 h-3" />
                          <span>{alert.ai_recommended_action}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {alert.status === 'open' && (
                    <button
                      onClick={() => base44.entities.MaintenanceAlert.update(alert.id, { status: 'scheduled' })}
                      className="text-xs text-blue-600 hover:underline shrink-0"
                    >
                      Schedule
                    </button>
                  )}
                  {alert.status === 'scheduled' && (
                    <button
                      onClick={() => base44.entities.MaintenanceAlert.update(alert.id, { status: 'resolved', resolved_at: new Date().toISOString() })}
                      className="text-xs text-green-600 hover:underline shrink-0"
                    >
                      Mark Resolved
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}