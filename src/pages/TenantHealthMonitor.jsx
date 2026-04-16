import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Shield, AlertTriangle, Activity, Brain, RefreshCw, CheckCircle, Lock, XCircle, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const severityColors = {
  low: 'bg-blue-50 text-blue-700 border-blue-200',
  medium: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  critical: 'bg-red-50 text-red-700 border-red-200',
};

const alertTypeLabels = {
  cross_tenant_query: 'Cross-Tenant Query',
  data_leakage_attempt: 'Data Leakage',
  unusual_query_pattern: 'Unusual Pattern',
  bulk_cross_tenant_read: 'Bulk Cross-Read',
  auth_anomaly: 'Auth Anomaly',
  quarantine_triggered: 'Quarantine',
};

export default function TenantHealthMonitor() {
  const qc = useQueryClient();
  const [scanHours, setScanHours] = useState('24');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['tenant-health-alerts'],
    queryFn: () => base44.entities.TenantHealthAlert.list('-created_date', 100),
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => base44.entities.Tenant.list(),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.TenantHealthAlert.update(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenant-health-alerts'] }),
  });

  const liftQuarantineMutation = useMutation({
    mutationFn: (tenantId) => base44.entities.Tenant.update(tenantId, { quarantine_active: false, quarantine_reason: '' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenants'] }),
  });

  const runScan = async () => {
    setScanning(true);
    try {
      const res = await base44.functions.invoke('aiTenantHealthMonitor', { scan_hours: parseInt(scanHours) });
      setScanResult(res.data);
      qc.invalidateQueries({ queryKey: ['tenant-health-alerts'] });
      qc.invalidateQueries({ queryKey: ['tenants'] });
    } finally {
      setScanning(false);
    }
  };

  const filtered = alerts.filter(a => statusFilter === 'all' || a.status === statusFilter);
  const critical = alerts.filter(a => a.severity === 'critical').length;
  const quarantined = tenants.filter(t => t.quarantine_active).length;
  const openAlerts = alerts.filter(a => a.status === 'new').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-jakarta flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" /> Tenant Health Monitor
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">AI-driven cross-tenant anomaly detection and data isolation enforcement</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={scanHours} onValueChange={setScanHours}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Scan window" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Last 1 hour</SelectItem>
              <SelectItem value="6">Last 6 hours</SelectItem>
              <SelectItem value="24">Last 24 hours</SelectItem>
              <SelectItem value="72">Last 72 hours</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={runScan} disabled={scanning} className="gap-2">
            <Brain className={`w-4 h-4 ${scanning ? 'animate-pulse' : ''}`} />
            {scanning ? 'Scanning…' : 'Run AI Scan'}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Open Alerts', value: openAlerts, icon: AlertTriangle, color: openAlerts > 0 ? 'text-orange-600' : 'text-muted-foreground' },
          { label: 'Critical', value: critical, icon: XCircle, color: critical > 0 ? 'text-red-600' : 'text-muted-foreground' },
          { label: 'Quarantined Tenants', value: quarantined, icon: Lock, color: quarantined > 0 ? 'text-red-600' : 'text-muted-foreground' },
          { label: 'Total Tenants', value: tenants.length, icon: Shield, color: 'text-primary' },
        ].map(s => (
          <Card key={s.label} className="border-border/60">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between mb-1">
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <div className={`text-2xl font-bold font-jakarta ${s.color}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Last scan result */}
      {scanResult && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-primary">Scan Complete — {scanResult.scan_period_hours}h window</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Analysed {scanResult.events_scanned} events across {scanResult.users_analysed} users.
                  Baseline: μ={scanResult.baseline?.mean} σ={scanResult.baseline?.stddev} threshold={scanResult.baseline?.threshold}.
                  Created {scanResult.new_alerts_created} new alerts.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quarantined Tenants */}
      {quarantined > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-red-700 flex items-center gap-2"><Lock className="w-4 h-4" /> Quarantined Tenants</h3>
          {tenants.filter(t => t.quarantine_active).map(t => (
            <div key={t.id} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
              <div>
                <p className="text-sm font-semibold text-red-800">{t.company_name}</p>
                <p className="text-xs text-red-600">{t.quarantine_reason}</p>
              </div>
              <Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-100"
                onClick={() => liftQuarantineMutation.mutate(t.id)}>
                Lift Quarantine
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Tenant Health Scores */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold font-jakarta">Tenant Health Scores</h3>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {tenants.map(t => (
            <Card key={t.id} className={`border-border/60 ${t.quarantine_active ? 'border-red-300' : ''}`}>
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold font-jakarta">{t.company_name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{t.tenant_type} · {t.status}</p>
                  </div>
                  <div className="text-right">
                    <div className={`text-xl font-bold font-jakarta ${(t.health_score || 100) >= 80 ? 'text-green-600' : (t.health_score || 100) >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {t.health_score ?? 100}
                    </div>
                    <div className="text-xs text-muted-foreground">health</div>
                  </div>
                </div>
                {t.quarantine_active && (
                  <Badge variant="destructive" className="text-xs mt-2">Quarantined</Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold font-jakarta">Security Alerts ({filtered.length})</h3>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="investigating">Investigating</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="false_positive">False Positive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          [1,2,3].map(i => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            <CheckCircle className="w-8 h-8 mx-auto mb-3 text-green-500 opacity-60" />
            No alerts found. Run an AI scan to check for anomalies.
          </div>
        ) : filtered.map(alert => (
          <Card key={alert.id} className={`border ${severityColors[alert.severity]}`}>
            <CardContent className="pt-3 pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge className={`text-xs border ${severityColors[alert.severity]}`} variant="outline">
                      {alert.severity}
                    </Badge>
                    <span className="text-xs font-semibold">{alertTypeLabels[alert.alert_type] || alert.alert_type}</span>
                    {alert.quarantine_applied && (
                      <Badge variant="destructive" className="text-xs">Quarantined</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    User: <span className="font-medium">{alert.user_email || alert.user_id || '—'}</span>
                    {alert.deviation_score != null && ` · Deviation: ${alert.deviation_score}%`}
                    {alert.observed_value != null && ` · Observed: ${alert.observed_value}`}
                  </p>
                  {alert.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{alert.notes}</p>}
                  <p className="text-xs text-muted-foreground mt-1">{alert.created_date ? format(new Date(alert.created_date), 'MMM d, HH:mm') : ''}</p>
                </div>
                {alert.status === 'new' && (
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="outline" className="h-7 text-xs px-2"
                      onClick={() => resolveMutation.mutate({ id: alert.id, status: 'investigating' })}>
                      Investigate
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs px-2"
                      onClick={() => resolveMutation.mutate({ id: alert.id, status: 'false_positive' })}>
                      FP
                    </Button>
                  </div>
                )}
                {alert.status === 'investigating' && (
                  <Button size="sm" className="h-7 text-xs px-2 shrink-0"
                    onClick={() => resolveMutation.mutate({ id: alert.id, status: 'resolved' })}>
                    Resolve
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}