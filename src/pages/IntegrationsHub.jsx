import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, Send, CreditCard, Zap, PlugZap, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { INTEGRATIONS } from '@/lib/integrationsMeta';

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
    <div className="space-y-6 mt-4">
      {/* SMS Test */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Send className="w-4 h-4 text-primary" /> Test SMS</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Recipient phone (e.g. 256771234567)" value={smsForm.to} onChange={e => setSmsForm(f => ({ ...f, to: e.target.value }))} />
          <Input placeholder="Message (max 480 chars)" value={smsForm.message} onChange={e => setSmsForm(f => ({ ...f, message: e.target.value }))} />
          <Button size="sm" onClick={handleSendSms} disabled={loading === 'sms'} className="gap-2">
            {loading === 'sms' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Send SMS
          </Button>
        </CardContent>
      </Card>

      {/* Payment Collection Test */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><CreditCard className="w-4 h-4 text-primary" /> Test Payment Collection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
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

export default function IntegrationsHub() {
  const [selected, setSelected] = useState(null);

  const { data: queueItems = [] } = useQuery({
    queryKey: ['integration-queue-recent'],
    queryFn: () => base44.entities.IntegrationQueue.list('-created_date', 20),
  });

  const recentWebhooks = queueItems.filter(q => q.direction === 'inbound');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-jakarta flex items-center gap-2">
          <PlugZap className="w-6 h-6 text-primary" /> Integrations Hub
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Manage all external service integrations for NLSWMS</p>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-2 gap-4">
        {INTEGRATIONS.map(intg => (
          <Card
            key={intg.id}
            className={`border-border/60 cursor-pointer transition-all hover:shadow-md ${selected === intg.id ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setSelected(selected === intg.id ? null : intg.id)}
          >
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{intg.logo}</span>
                  <div>
                    <p className="font-semibold text-sm font-jakarta">{intg.name}</p>
                    <Badge className="text-[10px] bg-green-100 text-green-700 mt-0.5" variant="secondary">
                      <CheckCircle2 className="w-2.5 h-2.5 mr-1" /> Connected
                    </Badge>
                  </div>
                </div>
                {intg.docsUrl && (
                  <a href={intg.docsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline" onClick={e => e.stopPropagation()}>
                    Docs ↗
                  </a>
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-3">{intg.description}</p>
              <div className="flex flex-wrap gap-1">
                {intg.features.map(f => (
                  <Badge key={f} variant="secondary" className="text-[10px]">{f}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* CitoConnect detail panel */}
      {selected === 'citoconnect' && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-jakarta flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" /> CitoConnect — Test & Configure
            </CardTitle>
          </CardHeader>
          <CardContent>
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
    </div>
  );
}