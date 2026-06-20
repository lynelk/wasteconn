import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, Mail, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function NotificationSettings({ customer }) {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState({
    email_alerts_enabled: customer?.email_alerts_enabled || false,
    whatsapp_alerts_enabled: customer?.whatsapp_alerts_enabled || false,
    in_app_alerts_enabled: customer?.in_app_alerts_enabled !== false // default true
  });

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      await base44.entities.Customer.update(customer.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Notification settings updated');
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
    }
  });

  const handleToggle = (key) => {
    const newValue = !settings[key];
    setSettings(prev => ({ ...prev, [key]: newValue }));
    updateMutation.mutate({ [key]: newValue });
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold font-jakarta flex items-center gap-2">
          <Bell className="w-4 h-4" />
          Notification Preferences
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="w-4 h-4 text-primary" />
            <div>
              <Label className="text-sm font-medium">In-App Alerts</Label>
              <p className="text-xs text-muted-foreground">Receive notifications in the app</p>
            </div>
          </div>
          <Switch
            checked={settings.in_app_alerts_enabled}
            onCheckedChange={() => handleToggle('in_app_alerts_enabled')}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="w-4 h-4 text-blue-600" />
            <div>
              <Label className="text-sm font-medium">Email Alerts</Label>
              <p className="text-xs text-muted-foreground">Receive email reminders</p>
            </div>
          </div>
          <Switch
            checked={settings.email_alerts_enabled}
            onCheckedChange={() => handleToggle('email_alerts_enabled')}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageCircle className="w-4 h-4 text-green-600" />
            <div>
              <Label className="text-sm font-medium">WhatsApp Alerts</Label>
              <p className="text-xs text-muted-foreground">Receive WhatsApp messages</p>
            </div>
          </div>
          <Switch
            checked={settings.whatsapp_alerts_enabled}
            onCheckedChange={() => handleToggle('whatsapp_alerts_enabled')}
          />
        </div>

        {updateMutation.isPending && (
          <p className="text-xs text-muted-foreground text-center">Saving changes...</p>
        )}
      </CardContent>
    </Card>
  );
}