import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { logger } from '@/lib/logger';
import { format } from 'date-fns';
import {
  Activity, AlertTriangle, CheckCircle, RefreshCw, Zap,
  XCircle, Clock, TrendingUp, Wifi, WifiOff, ChevronDown, ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const severityColors = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-blue-100 text-blue-700 border-blue-200',
};

const statusColors = {
  new: 'bg-red-100 text-red-700',
  acknowledged: 'bg-yellow-100 text-yellow-700',
  resolved: 'bg-green-100 text-green-700',
};

function AlertCard({ alert, onAck }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`border rounded-xl p-4 ${severityColors[alert.severity] || 'bg-muted'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{alert.alert_type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
            <p className="text-xs mt-0.5 line-clamp-2">{alert.message}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="secondary" className={`text-xs ${statusColors[alert.status] || ''}`}>{alert.status}</Badge>
          {alert.status === 'new' && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onAck(alert.id)}>Ack</Button>
          )}
          <button onClick={() => setExpanded(!expanded)} className="text-current/60 hover:text-current">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="mt-3 pt-3 border-t border-current/20 text-xs space-y-1">
          <p><span className="font-medium">Vehicle:</span> {alert.registration_number || alert.vehicle_id || '—'}</p>
          {alert.latitude && <p><span className="font-medium">Location:</span> {alert.latitude.toFixed(4)}, {alert.longitude.toFixed(4)}</p>}
          {alert.deviation_meters && <p><span className="font-medium">Deviation:</span> {alert.deviation_meters}m</p>}
          {alert.idle_seconds && <p><span className="font-medium">Idle Time:</span> {Math.round(alert.idle_seconds / 60)} mins</p>}
          <p className="text-current/60">{alert.created_date ? format(new Date(alert.created_date), 'MMM d, yyyy HH:mm') : ''}</p>
        </div>
      )}
    </div>
  );
}

export default function IntegrationHealth() {
  const qc = useQueryClient();
  const [fraudRunning, setFraudRunning] = useState(false);
  const [fraudResults, setFraudResults] = useState(null);

  const { data: fleetAlerts = [], isLoading: alertsLoading } = useQuery({
    queryKey: ['fleet-alerts'],
    queryFn: () => base44.entities.FleetAlert.list('-created_date', 100),
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['audit-logs-recent'],
    queryFn: () => base44.entities.AuditLog.list('-created_date', 50),
  });

  const { data: telematics = [] } = useQuery({
    queryKey: ['telematics-all'],
    queryFn: () => base44.entities.VehicleTelematics.list('-timestamp', 20),
  });

  const ackMutation = useMutation({
    mutationFn: id => base44.entities.FleetAlert.update(id, { status: 'acknowledged', acknowledged_at: new Date().toISOString() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fleet-alerts'] }),
  });

  const handleFraudScan = async () => {
    setFraudRunning(true);
    try {
      const res = await base44.functions.invoke('aiPaymentFraudCheck', { lookback_days: 30 });
      setFraudResults(res.data);
    } catch (e) {
      logger.error('integrationHealth.fraudCheck.error', { message: e?.message });
    } finally {
      setFraudRunning(false);
    }
  };

  const newAlerts = fleetAlerts.filter(a => a.status === 'new');
  const criticalAlerts = fleetAlerts.filter(a => a.severity === 'critical' && a.status !== 'resolved');
  const flaggedLogs = auditLogs.filter(l => l.flagged);
  const activeTelematics = telematics.filter(t => t.is_active);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-jakarta flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" /> Integration Health
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Fleet alerts, fraud detection, audit anomalies & system status</p>
        </div>
        <Button onClick={handleFraudScan} disabled={fraudRunning} variant="outline" className="gap-2">
          {fraudRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          Run Fraud Scan
        </Button>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'New Fleet Alerts', value: newAlerts.length, icon: AlertTriangle, color: newAlerts.length > 0 ? 'text-red-600' : 'text-green-600' },
          { label: 'Critical Alerts', value: criticalAlerts.length, icon: XCircle, color: criticalAlerts.length > 0 ? 'text-red-600' : 'text-green-600' },
          { label: 'Active Vehicles', value: activeTelematics.length, icon: Wifi, color: 'text-blue-600' },
          { label: 'Flagged Audit Events', value: flaggedLogs.length, icon: TrendingUp, color: flaggedLogs.length > 0 ? 'text-orange-600' : 'text-green-600' },
        ].map(s => (
          <Card key={s.label} className="border-border/60">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className={`text-2xl font-bold font-jakarta ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
                </div>
                <s.icon className={`w-6 h-6 ${s.color} opacity-60`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="fleet">
        <TabsList>
          <TabsTrigger value="fleet" className="gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Fleet Alerts {newAlerts.length > 0 && <Badge className="ml-1 text-xs bg-red-500 text-white h-4 px-1">{newAlerts.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="fraud" className="gap-1.5"><Zap className="w-3.5 h-3.5" /> Fraud Detection</TabsTrigger>
          <TabsTrigger value="telematics" className="gap-1.5"><Wifi className="w-3.5 h-3.5" /> Telematics</TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5"><Activity className="w-3.5 h-3.5" /> Audit Anomalies</TabsTrigger>
        </TabsList>

        {/* Fleet Alerts */}
        <TabsContent value="fleet" className="mt-4 space-y-3">
          {alertsLoading ? (
            <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-16 bg-muted rounded-xl animate-pulse"/>)}</div>
          ) : fleetAlerts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-500 opacity-60" />
              <p>No fleet alerts — all systems operational</p>
            </div>
          ) : (
            <>
              <div className="flex gap-2 text-xs text-muted-foreground">
                <span>{newAlerts.length} new</span>·
                <span>{fleetAlerts.filter(a=>a.status==='acknowledged').length} acknowledged</span>·
                <span>{fleetAlerts.filter(a=>a.status==='resolved').length} resolved</span>
              </div>
              {fleetAlerts.map(a => (
                <AlertCard key={a.id} alert={a} onAck={id => ackMutation.mutate(id)} />
              ))}
            </>
          )}
        </TabsContent>

        {/* Fraud Detection */}
        <TabsContent value="fraud" className="mt-4">
          {!fraudResults ? (
            <div className="text-center py-16 text-muted-foreground">
              <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="mb-4">Run a fraud scan to analyse recent payment transactions</p>
              <Button onClick={handleFraudScan} disabled={fraudRunning} className="gap-2">
                {fraudRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {fraudRunning ? 'Scanning...' : 'Run Fraud Scan (Last 30 Days)'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Analysed <span className="font-semibold text-foreground">{fraudResults.total_analysed}</span> payments · 
                  <span className={`font-semibold ml-1 ${fraudResults.flagged_count > 0 ? 'text-red-600' : 'text-green-600'}`}>{fraudResults.flagged_count} flagged</span>
                </div>
                <Button size="sm" variant="outline" onClick={handleFraudScan} disabled={fraudRunning} className="gap-1 h-7 text-xs">
                  <RefreshCw className={`w-3 h-3 ${fraudRunning ? 'animate-spin' : ''}`} /> Re-scan
                </Button>
              </div>
              {fraudResults.flagged_count === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-10 h-10 mx-auto mb-2 text-green-500" />
                  <p className="text-sm text-muted-foreground">No suspicious transactions detected in the last 30 days</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {fraudResults.flagged.map((f, i) => (
                    <div key={i} className={`border rounded-xl p-4 ${f.risk_level === 'high' ? 'border-red-200 bg-red-50' : f.risk_level === 'medium' ? 'border-orange-200 bg-orange-50' : 'border-yellow-200 bg-yellow-50'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-sm">{(f.amount_ugx||0).toLocaleString()} UGX</span>
                            <Badge variant="secondary" className={`text-xs ${f.risk_level === 'high' ? 'bg-red-100 text-red-700' : f.risk_level === 'medium' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>
                              Risk: {f.risk_level}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {f.payment_method?.replace('_',' ')} · {f.transaction_ref || 'No ref'} · {f.payment_date ? format(new Date(f.payment_date), 'MMM d, yyyy HH:mm') : '—'}
                          </p>
                          <ul className="mt-2 space-y-0.5">
                            {f.anomalies.map((a, ai) => (
                              <li key={ai} className="text-xs flex items-start gap-1.5">
                                <span className="text-orange-500 mt-0.5">⚠</span>{a}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-lg font-bold font-jakarta text-red-600">{f.fraud_score}</div>
                          <div className="text-xs text-muted-foreground">score</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* Telematics Status */}
        <TabsContent value="telematics" className="mt-4">
          {telematics.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <WifiOff className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No telematics data received yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {telematics.map(t => (
                <div key={t.id} className="flex items-center gap-4 p-4 rounded-xl border border-border/60 bg-card">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${t.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{t.registration_number || t.vehicle_id}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.latitude?.toFixed(4)}, {t.longitude?.toFixed(4)} · {t.speed_kmh ?? 0} km/h · Fuel: {t.fuel_level_pct ?? '—'}%
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge variant="secondary" className="text-xs">{t.provider}</Badge>
                    <p className="text-xs text-muted-foreground mt-1">{t.timestamp ? format(new Date(t.timestamp), 'HH:mm') : '—'}</p>
                  </div>
                  {t.ignition_on && <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" title="Engine on" />}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Audit Anomalies */}
        <TabsContent value="audit" className="mt-4">
          {auditLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No audit events yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {auditLogs.map(log => (
                <div key={log.id} className={`flex items-start gap-4 p-4 rounded-xl border bg-card ${log.flagged ? 'border-red-200 bg-red-50/40' : 'border-border/60'}`}>
                  <div className={`shrink-0 mt-0.5 ${log.flagged ? 'text-red-500' : 'text-muted-foreground'}`}>
                    {log.flagged ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium capitalize">{log.event_type?.replace(/_/g, ' ')}</p>
                      {log.flagged && <Badge className="text-xs bg-red-100 text-red-700" variant="secondary">Flagged</Badge>}
                      {log.risk_score >= 70 && <Badge className="text-xs bg-orange-100 text-orange-700" variant="secondary">Risk: {log.risk_score}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {log.entity_type} · {log.user_email || 'System'} · {log.created_date ? format(new Date(log.created_date), 'MMM d, HH:mm') : '—'}
                    </p>
                    {log.notes && <p className="text-xs italic text-muted-foreground mt-1">{log.notes}</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    {log.risk_score != null && (
                      <div className={`text-sm font-bold font-jakarta ${log.risk_score >= 70 ? 'text-red-600' : log.risk_score >= 40 ? 'text-orange-600' : 'text-muted-foreground'}`}>
                        {log.risk_score}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}