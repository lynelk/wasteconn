import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  CheckCircle2, Send, CreditCard, RefreshCw, PlugZap,
  Settings2, AlertCircle, XCircle, Activity, Zap
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { INTEGRATIONS } from '@/lib/integrationsMeta';
import ConfigureIntegrationModal from '@/components/integrations/ConfigureIntegrationModal';

// CitoConnect live-test panel (unchanged from original)
function CitoConnectTestPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState('');
  const [smsForm, setSmsForm] = useState({ to: '', message: '' });
  const [collectForm, setCollectForm] = useState({ phone: '', amount: '', reference: '' });

  const handleSendSms = async () => {
    if (!smsForm.to || !smsForm.message) return;
    setLoading('sms');
    const res = await base44.functions.invoke('citoConnectService', { action: 'send_sms', to: smsForm.to, message: smsForm.message });
    setLoading('');
    if (res.data?.status === 'OK') {
      toast({ title: 'SMS Sent', description: `Delivered to ${res.data.recipients} recipient(s).` });
    } else {
      toast({ title: 'SMS Failed', description: JSON.stringify(res.data), variant: 'destructive' });
    }
  };

  const handleCollect = async () => {
    if (!collectForm.phone || !collectForm.amount || !collectForm.reference) return;
    setLoading('collect');
    const res = await base44.functions.invoke('citoConnectService', {
      action: 'collect_payment',
      phone: collectForm.phone,
      amount: parseFloat(collectForm.amount),
      currency: 'UGX',
      reference: collectForm.reference,
    });
    setLoading('');
    if (res.data?.id) {
      toast({ title: 'Payment Initiated', description: `Txn ID: ${res.data.id} — Status: ${res.data.status}` });
    } else {
      toast({ title: 'Payment Failed', description: JSON.stringify(res.data), variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <Card className="border-border/60">
        <CardContent className="pt-4 space-y-3">
          <p className="text-sm font-medium flex items-center gap-2"><Send className="w-4 h-4 text-primary" /> Test SMS</p>
          <Input placeholder="Recipient phone (e.g. 256771234567)" value={smsForm.to} onChange={e => setSmsForm(f => ({ ...f, to: e.target.value }))} />
          <Input placeholder="Message (max 480 chars)" value={smsForm.message} onChange={e => setSmsForm(f => ({ ...f, message: e.target.value }))} />
          <Button size="sm" onClick={handleSendSms} disabled={loading === 'sms'} className="gap-2">
            {loading === 'sms' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Send SMS
          </Button>
        </CardContent>
      </Card>
      <Card className="border-border/60">
        <CardContent className="pt-4 space-y-3">
          <p className="text-sm font-medium flex items-center gap-2"><CreditCard className="w-4 h-4 text-primary" /> Test Payment Collection</p>
          <Input placeholder="Phone (e.g. 256771234567)" value={collectForm.phone} onChange={e => setCollectForm(f => ({ ...f, phone: e.target.value }))} />
          <Input placeholder="Amount (UGX)" type="number" value={collectForm.amount} onChange={e => setCollectForm(f => ({ ...f, amount: e.target.value }))} />
          <Input placeholder="Unique reference (e.g. INV-2026-001)" value={collectForm.reference} onChange={e => setCollectForm(f => ({ ...f, reference: e.target.value }))} />
          <Button size="sm" onClick={handleCollect} disabled={loading === 'collect'} className="gap-2">
            {loading === 'collect' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CreditCard className="w-3 h-3" />} Initiate Collection
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// Status badge helper
function StatusBadge({ status }) {
  const map = {
    healthy: { label: 'Connected', className: 'bg-green-100 text-green-700', Icon: CheckCircle2 },
    error: { label: 'Error', className: 'bg-red-100 text-red-700', Icon: AlertCircle },
    disabled: { label: 'Disabled', className: 'bg-gray-100 text-gray-500', Icon: XCircle },
    unconfigured: { label: 'Unconfigured', className: 'bg-yellow-100 text-yellow-700', Icon: AlertCircle },
  };
  const { label, className, Icon } = map[status] || map.unconfigured;
  return (
    <Badge className={`text-[10px] ${className}`} variant="secondary">
      <Icon className="w-2.5 h-2.5 mr-1" /> {label}
    </Badge>
  );
}

export default function IntegrationsHub() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [configModalIntg, setConfigModalIntg] = useState(null);
  const [activePanel, setActivePanel] = useState(null);

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['integration-configs'],
    queryFn: () => base44.entities.IntegrationConfig.list(),
  });

  const { data: queueItems = [] } = useQuery({
    queryKey: ['integration-queue-recent'],
    queryFn: () => base44.entities.IntegrationQueue.list('-created_date', 20),
  });

  const getConfig = (id) => configs.find(c => c.integration_id === id);

  const handleToggle = async (intg, newValue) => {
    const cfg = getConfig(intg.id);
    if (cfg) {
      await base44.entities.IntegrationConfig.update(cfg.id, {
        is_active: newValue,
        status: newValue ? 'healthy' : 'disabled',
      });
    } else {
      await base44.entities.IntegrationConfig.create({
        integration_id: intg.id,
        is_active: newValue,
        status: newValue ? 'unconfigured' : 'disabled',
      });
    }
    queryClient.invalidateQueries({ queryKey: ['integration-configs'] });
    toast({ title: newValue ? `${intg.name} enabled` : `${intg.name} disabled` });
  };

  const recentWebhooks = queueItems.filter(q => q.direction === 'inbound');
  const activePanelIntg = INTEGRATIONS.find(i => i.id === activePanel);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-jakarta flex items-center gap-2">
          <PlugZap className="w-6 h-6 text-primary" /> Integrations Hub
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Manage all external service integrations for NLSWMS</p>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {[1,2,3,4,5].map(i => <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-2 gap-4">
          {INTEGRATIONS.map(intg => {
            const cfg = getConfig(intg.id);
            const status = cfg?.status || 'unconfigured';
            const isActive = cfg?.is_active ?? false;
            const isPanelOpen = activePanel === intg.id;

            return (
              <Card
                key={intg.id}
                className={`border-border/60 transition-all hover:shadow-md ${isPanelOpen ? 'ring-2 ring-primary' : ''}`}
              >
                <CardContent className="pt-5 pb-4">
                  {/* Header row */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{intg.logo}</span>
                      <div>
                        <p className="font-semibold text-sm font-jakarta">{intg.name}</p>
                        <StatusBadge status={status} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={isActive}
                        onCheckedChange={(v) => handleToggle(intg, v)}
                        className="scale-90"
                      />
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground mb-3">{intg.description}</p>

                  <div className="flex flex-wrap gap-1 mb-4">
                    {intg.features.map(f => (
                      <Badge key={f} variant="secondary" className="text-[10px]">{f}</Badge>
                    ))}
                  </div>

                  {/* Action row */}
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 h-7 text-xs"
                      onClick={() => setConfigModalIntg(intg)}
                    >
                      <Settings2 className="w-3 h-3" /> Configure
                    </Button>
                    {intg.id === 'citoconnect' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 h-7 text-xs"
                        onClick={() => setActivePanel(isPanelOpen ? null : intg.id)}
                      >
                        <Zap className="w-3 h-3" /> Test
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 h-7 text-xs"
                      onClick={() => setActivePanel(isPanelOpen && activePanel !== intg.id + '_logs' ? null : intg.id + '_logs')}
                    >
                      <Activity className="w-3 h-3" /> Logs
                    </Button>
                    {intg.docsUrl && (
                      <a href={intg.docsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline ml-auto">
                        Docs ↗
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* CitoConnect test panel */}
      {activePanel === 'citoconnect' && (
        <Card className="border-primary/30">
          <CardContent className="pt-5">
            <p className="font-semibold text-sm font-jakarta flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-primary" /> CitoConnect — Live Test
            </p>
            <Tabs defaultValue="test">
              <TabsList>
                <TabsTrigger value="test">Test Endpoints</TabsTrigger>
                <TabsTrigger value="webhooks">Recent Webhooks</TabsTrigger>
              </TabsList>
              <TabsContent value="test">
                <CitoConnectTestPanel />
              </TabsContent>
              <TabsContent value="webhooks" className="mt-4">
                {recentWebhooks.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">No inbound webhooks received yet.</p>
                ) : (
                  <div className="space-y-2">
                    {recentWebhooks.map(item => {
                      const payload = (() => { try { return JSON.parse(item.payload); } catch { return {}; } })();
                      return (
                        <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 text-xs">
                          <div>
                            <span className="font-medium text-foreground">{payload.event_type || 'Unknown event'}</span>
                            <span className="ml-2 text-muted-foreground">{payload.reference || '—'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className={`text-[10px] ${item.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {item.status}
                            </Badge>
                            <span className="text-muted-foreground">{item.created_date ? new Date(item.created_date).toLocaleString() : ''}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Generic activity log panel for other integrations */}
      {activePanel && activePanel.endsWith('_logs') && (
        <Card className="border-primary/30">
          <CardContent className="pt-5">
            <p className="font-semibold text-sm font-jakarta flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-primary" /> Recent Activity — {INTEGRATIONS.find(i => activePanel.startsWith(i.id))?.name}
            </p>
            {queueItems.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No activity recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {queueItems.slice(0, 10).map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 text-xs">
                    <div>
                      <span className="font-medium text-foreground capitalize">{item.event_type?.replace(/_/g, ' ') || 'Event'}</span>
                      <span className="ml-2 text-muted-foreground">{item.endpoint || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={`text-[10px] ${item.status === 'success' ? 'bg-green-100 text-green-700' : item.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {item.status}
                      </Badge>
                      <span className="text-muted-foreground">{item.created_date ? new Date(item.created_date).toLocaleString() : ''}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Configure modal */}
      {configModalIntg && (
        <ConfigureIntegrationModal
          integration={configModalIntg}
          config={getConfig(configModalIntg.id)}
          open={!!configModalIntg}
          onClose={() => setConfigModalIntg(null)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['integration-configs'] })}
        />
      )}
    </div>
  );
}