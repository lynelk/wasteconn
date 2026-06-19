import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Save, RefreshCw, Eye, EyeOff, CheckCircle2, AlertCircle, XCircle, TestTube2 } from 'lucide-react';

// Per-integration credential field definitions
// Each field maps to a top-level IntegrationConfig property
const CREDENTIAL_FIELDS = {
  citoconnect: [
    { key: 'api_url', label: 'API URL', placeholder: 'https://api.citoconnect.com', type: 'url' },
    { key: 'api_key', label: 'API Key', placeholder: 'Enter CitoConnect API key', type: 'password' },
  ],
  wialon: [
    { key: 'api_url', label: 'Wialon Host URL', placeholder: 'https://hst-api.wialon.com', type: 'url' },
    { key: 'api_key', label: 'Access Token', placeholder: 'Enter Wialon access token', type: 'password' },
  ],
  yopayments: [
    { key: 'api_url', label: 'API URL', placeholder: 'https://paymentsapi.yo.co.ug', type: 'url' },
    { key: 'username', label: 'Username', placeholder: 'Yo! Payments username', type: 'text' },
    { key: 'api_secret', label: 'Password', placeholder: 'Yo! Payments password', type: 'password' },
  ],
  quickbooks: [
    { key: 'api_key', label: 'Client ID', placeholder: 'QuickBooks OAuth Client ID', type: 'text' },
    { key: 'api_secret', label: 'Client Secret', placeholder: 'QuickBooks OAuth Client Secret', type: 'password' },
    { key: 'refresh_token', label: 'Refresh Token', placeholder: 'OAuth Refresh Token (from initial auth flow)', type: 'password' },
    { key: 'access_token', label: 'Access Token', placeholder: 'Cached access token (auto-managed)', type: 'password' },
  ],
  merx365: [
    { key: 'api_url', label: 'API URL', placeholder: 'https://api.merx365.com', type: 'url' },
    { key: 'api_key', label: 'API Key', placeholder: 'Enter Merx365 API key', type: 'password' },
  ],
};

// Per-integration settings fields (stored in the `settings` object)
const SETTINGS_FIELDS = {
  wialon: [
    { key: 'poll_interval_minutes', label: 'Poll Interval (minutes)', placeholder: '5', type: 'number', default: '5' },
    { key: 'deviation_threshold_m', label: 'Route Deviation Threshold (metres)', placeholder: '500', type: 'number', default: '500' },
  ],
  quickbooks: [
    { key: 'realm_id', label: 'Realm ID (Company ID)', placeholder: 'e.g. 1234567890', type: 'text' },
  ],
};

const STATUS_BADGE = {
  healthy: { label: 'Healthy', className: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  error: { label: 'Error', className: 'bg-red-100 text-red-700', icon: AlertCircle },
  disabled: { label: 'Disabled', className: 'bg-gray-100 text-gray-600', icon: XCircle },
  unconfigured: { label: 'Unconfigured', className: 'bg-yellow-100 text-yellow-700', icon: AlertCircle },
};

export default function ConfigureIntegrationModal({ integration, config, open, onClose, onSaved }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showSecrets, setShowSecrets] = useState({});
  const [form, setForm] = useState({
    is_active: true,
    api_url: '',
    api_key: '',
    api_secret: '',
    username: '',
    refresh_token: '',
    access_token: '',
    token_expires_at: '',
    webhook_secret: '',
    notes: '',
    settings: {},
  });

  useEffect(() => {
    if (config) {
      setForm({
        is_active: config.is_active ?? true,
        api_url: config.api_url || '',
        api_key: config.api_key || '',
        api_secret: config.api_secret || '',
        username: config.username || '',
        refresh_token: config.refresh_token || '',
        access_token: config.access_token || '',
        token_expires_at: config.token_expires_at || '',
        webhook_secret: config.webhook_secret || '',
        notes: config.notes || '',
        settings: config.settings || {},
      });
    } else {
      setForm({
        is_active: true, api_url: '', api_key: '', api_secret: '', username: '',
        refresh_token: '', access_token: '', token_expires_at: '', webhook_secret: '',
        notes: '', settings: {},
      });
    }
    setShowSecrets({});
  }, [config, open]);

  const setSettingField = (key, value) => {
    setForm(f => ({ ...f, settings: { ...f.settings, [key]: value } }));
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      integration_id: integration.id,
      is_active: form.is_active,
      api_url: form.api_url || undefined,
      api_key: form.api_key || undefined,
      api_secret: form.api_secret || undefined,
      username: form.username || undefined,
      refresh_token: form.refresh_token || undefined,
      access_token: form.access_token || undefined,
      token_expires_at: form.token_expires_at || undefined,
      webhook_secret: form.webhook_secret || undefined,
      notes: form.notes || undefined,
      settings: Object.keys(form.settings).length > 0 ? form.settings : undefined,
      status: form.is_active ? (config?.status === 'healthy' ? 'healthy' : 'unconfigured') : 'disabled',
    };
    if (config?.id) {
      await base44.entities.IntegrationConfig.update(config.id, payload);
    } else {
      await base44.entities.IntegrationConfig.create(payload);
    }
    setSaving(false);
    toast({ title: 'Saved', description: `${integration.name} configuration updated.` });
    onSaved();
    onClose();
  };

  const handleTestConnection = async () => {
    if (integration.id !== 'quickbooks' && integration.id !== 'wialon') return;
    setTesting(true);
    try {
      if (integration.id === 'quickbooks') {
        const res = await base44.functions.invoke('quickbooksProvision', { action: 'refresh_token' });
        if (res.data?.success) {
          toast({ title: 'QuickBooks Connected', description: 'Token refreshed successfully.' });
        } else {
          toast({ title: 'Connection Failed', description: res.data?.error || 'Unknown error', variant: 'destructive' });
        }
      } else if (integration.id === 'wialon') {
        const res = await base44.functions.invoke('wialonSync');
        if (res.data?.stub) {
          toast({ title: 'Token Missing', description: res.data.message, variant: 'destructive' });
        } else if (res.data?.vehicles_synced !== undefined) {
          toast({ title: 'Wialon Connected', description: `Synced ${res.data.vehicles_synced} vehicles.` });
        } else {
          toast({ title: 'Connection Failed', description: res.data?.error || 'Unknown error', variant: 'destructive' });
        }
      }
    } catch (e) {
      toast({ title: 'Test Failed', description: e.message, variant: 'destructive' });
    }
    setTesting(false);
  };

  const toggleSecret = (key) => setShowSecrets(s => ({ ...s, [key]: !s[key] }));

  const fields = CREDENTIAL_FIELDS[integration?.id] || [];
  const settingsFields = SETTINGS_FIELDS[integration?.id] || [];
  const status = config?.status || 'unconfigured';
  const StatusMeta = STATUS_BADGE[status] || STATUS_BADGE.unconfigured;
  const StatusIcon = StatusMeta.icon;
  const canTest = integration?.id === 'quickbooks' || integration?.id === 'wialon';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 font-jakarta">
            <span className="text-2xl">{integration?.logo}</span>
            Configure {integration?.name}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="credentials">
          <TabsList className="w-full">
            <TabsTrigger value="credentials" className="flex-1">Credentials</TabsTrigger>
            {settingsFields.length > 0 && (
              <TabsTrigger value="integration_settings" className="flex-1">Settings</TabsTrigger>
            )}
            <TabsTrigger value="status" className="flex-1">Status</TabsTrigger>
            <TabsTrigger value="notes" className="flex-1">Notes</TabsTrigger>
          </TabsList>

          {/* Credentials Tab */}
          <TabsContent value="credentials" className="space-y-4 mt-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/40">
              <div>
                <p className="text-sm font-medium">Integration Active</p>
                <p className="text-xs text-muted-foreground">Enable or disable this integration globally</p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))}
              />
            </div>

            {fields.map(field => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={field.key} className="text-sm">{field.label}</Label>
                <div className="relative">
                  <Input
                    id={field.key}
                    type={field.type === 'password' && !showSecrets[field.key] ? 'password' : 'text'}
                    placeholder={field.placeholder}
                    value={form[field.key] || ''}
                    onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                    className="pr-10"
                  />
                  {field.type === 'password' && (
                    <button
                      type="button"
                      onClick={() => toggleSecret(field.key)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showSecrets[field.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  )}
                </div>
                {field.key === 'refresh_token' && (
                  <p className="text-xs text-muted-foreground">Obtain this by completing the QuickBooks OAuth authorization flow.</p>
                )}
                {field.key === 'access_token' && (
                  <p className="text-xs text-muted-foreground">Auto-managed. Leave blank to let the system refresh it automatically.</p>
                )}
              </div>
            ))}

            <div className="space-y-1.5">
              <Label htmlFor="webhook_secret" className="text-sm">Webhook Secret <span className="text-muted-foreground">(optional)</span></Label>
              <div className="relative">
                <Input
                  id="webhook_secret"
                  type={showSecrets.webhook_secret ? 'text' : 'password'}
                  placeholder="Shared secret for inbound webhooks"
                  value={form.webhook_secret}
                  onChange={e => setForm(f => ({ ...f, webhook_secret: e.target.value }))}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => toggleSecret('webhook_secret')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showSecrets.webhook_secret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </TabsContent>

          {/* Integration-specific Settings Tab */}
          {settingsFields.length > 0 && (
            <TabsContent value="integration_settings" className="space-y-4 mt-4">
              {settingsFields.map(field => (
                <div key={field.key} className="space-y-1.5">
                  <Label htmlFor={`settings_${field.key}`} className="text-sm">{field.label}</Label>
                  <Input
                    id={`settings_${field.key}`}
                    type={field.type}
                    placeholder={field.placeholder}
                    value={form.settings[field.key] ?? field.default ?? ''}
                    onChange={e => setSettingField(field.key, e.target.value)}
                  />
                </div>
              ))}
              <div className="rounded-lg border border-border/50 p-4 text-sm text-muted-foreground bg-muted/30">
                <p className="font-medium text-foreground mb-2">Features</p>
                <div className="flex flex-wrap gap-1">
                  {integration?.features?.map(f => (
                    <Badge key={f} variant="secondary" className="text-[10px]">{f}</Badge>
                  ))}
                </div>
                {integration?.docsUrl && (
                  <a href={integration.docsUrl} target="_blank" rel="noopener noreferrer" className="text-primary text-xs hover:underline mt-3 block">
                    View Documentation ↗
                  </a>
                )}
              </div>
            </TabsContent>
          )}

          {/* Status Tab */}
          <TabsContent value="status" className="space-y-4 mt-4">
            <div className="flex items-center gap-3 p-4 rounded-lg border border-border/50">
              <StatusIcon className={`w-5 h-5 ${status === 'healthy' ? 'text-green-600' : status === 'error' ? 'text-red-600' : 'text-yellow-600'}`} />
              <div>
                <p className="text-sm font-medium">Current Status</p>
                <Badge className={`text-[10px] mt-0.5 ${StatusMeta.className}`}>{StatusMeta.label}</Badge>
              </div>
              {canTest && (
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto gap-1.5 text-xs"
                  onClick={handleTestConnection}
                  disabled={testing}
                >
                  {testing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <TestTube2 className="w-3 h-3" />}
                  Test Connection
                </Button>
              )}
            </div>
            {config?.last_successful_sync_at && (
              <div className="text-sm text-muted-foreground p-3 rounded-lg bg-muted/30 border border-border/40">
                <span className="font-medium text-foreground">Last successful sync:</span>{' '}
                {new Date(config.last_successful_sync_at).toLocaleString()}
              </div>
            )}
            {config?.token_expires_at && (
              <div className="text-sm text-muted-foreground p-3 rounded-lg bg-muted/30 border border-border/40">
                <span className="font-medium text-foreground">Token expires:</span>{' '}
                {new Date(config.token_expires_at).toLocaleString()}
              </div>
            )}
            {config?.last_error && (
              <div className="text-sm text-red-600 p-3 rounded-lg bg-red-50 border border-red-200">
                <p className="font-medium mb-1">Last Error</p>
                <p className="text-xs font-mono break-all">{config.last_error}</p>
              </div>
            )}
            {!config && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No configuration saved yet. Add credentials in the Credentials tab to activate this integration.
              </p>
            )}
          </TabsContent>

          {/* Notes Tab */}
          <TabsContent value="notes" className="space-y-4 mt-4">
            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-sm">Internal Notes</Label>
              <Input
                id="notes"
                placeholder="Internal notes about this integration..."
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div className="rounded-lg border border-border/50 p-4 text-sm text-muted-foreground bg-muted/30">
              <p className="font-medium text-foreground mb-2">Features</p>
              <div className="flex flex-wrap gap-1">
                {integration?.features?.map(f => (
                  <Badge key={f} variant="secondary" className="text-[10px]">{f}</Badge>
                ))}
              </div>
              {integration?.docsUrl && (
                <a href={integration.docsUrl} target="_blank" rel="noopener noreferrer" className="text-primary text-xs hover:underline mt-3 block">
                  View Documentation ↗
                </a>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 mt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}