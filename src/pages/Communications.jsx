import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Bell, Send, Mail, MessageSquare, Zap, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import SendNotificationModal from '@/components/comms/SendNotificationModal';
import AIMessageComposer from '@/components/comms/AIMessageComposer';

const statusColor = {
  pending: 'bg-yellow-100 text-yellow-700',
  sent: 'bg-blue-100 text-blue-700',
  delivered: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

const channelIcon = {
  email: <Mail className="w-3 h-3" />,
  sms: <MessageSquare className="w-3 h-3" />,
  in_app: <Bell className="w-3 h-3" />,
};

export default function Communications() {
  const queryClient = useQueryClient();
  const [showSendModal, setShowSendModal] = useState(false);
  const [showAIComposer, setShowAIComposer] = useState(false);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => base44.entities.Notification.list('-created_date', 100),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const sent = notifications.filter(n => ['sent','delivered'].includes(n.status)).length;
  const failed = notifications.filter(n => n.status === 'failed').length;
  const pending = notifications.filter(n => n.status === 'pending').length;

  const templateTypes = ['pickup_reminder','pickup_completed','pickup_missed','pickup_rescheduled','invoice_issued','invoice_overdue','payment_received','welcome','custom'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-jakarta flex items-center gap-2">
            <Bell className="w-6 h-6 text-primary" /> Communications
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Send notifications via email, SMS, and in-app</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowAIComposer(true)}>
            <Zap className="w-4 h-4" /> AI Compose
          </Button>
          <Button size="sm" onClick={() => setShowSendModal(true)}>
            <Send className="w-4 h-4" /> Send Message
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border/60"><CardContent className="pt-5 pb-4">
          <div className="text-2xl font-bold font-jakarta text-green-600">{sent}</div>
          <p className="text-xs text-muted-foreground mt-1">Sent / Delivered</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="pt-5 pb-4">
          <div className="text-2xl font-bold font-jakarta text-yellow-600">{pending}</div>
          <p className="text-xs text-muted-foreground mt-1">Pending</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="pt-5 pb-4">
          <div className="text-2xl font-bold font-jakarta text-red-600">{failed}</div>
          <p className="text-xs text-muted-foreground mt-1">Failed</p>
        </CardContent></Card>
      </div>

      {/* Notification Log */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold font-jakarta">Notification Log</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">{[1,2,3].map(i => <div key={i} className="h-12 bg-muted rounded animate-pulse" />)}</div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No notifications sent yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    {['Time', 'Recipient', 'Channel', 'Template', 'Status', 'Delivery'].map(h => (
                     <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {notifications.map(n => (
                    <tr key={n.id} className="border-b border-border/40 hover:bg-muted/20">
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {n.created_date ? format(new Date(n.created_date), 'MMM d HH:mm') : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs">{n.recipient_email || n.recipient_phone || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground capitalize">
                          {channelIcon[n.channel]} {n.channel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs capitalize">{n.template_type?.replace(/_/g,' ')}</td>
                      <td className="px-4 py-3">
                         <Badge className={`text-xs ${statusColor[n.status] || ''}`} variant="secondary">{n.status}</Badge>
                       </td>
                       <td className="px-4 py-3 text-xs text-muted-foreground">
                         {n.delivered_at ? format(new Date(n.delivered_at), 'HH:mm') : n.status === 'failed' ? <span className="text-red-500">Failed</span> : '—'}
                         {n.ai_send_time_optimised && <span className="ml-1 text-primary" title="Send-time optimised by AI"><Brain className="w-3 h-3 inline" /></span>}
                       </td>
                      </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {showSendModal && (
        <SendNotificationModal
          customers={customers}
          onClose={() => setShowSendModal(false)}
          onSaved={() => { queryClient.invalidateQueries({ queryKey: ['notifications'] }); setShowSendModal(false); }}
        />
      )}
      {showAIComposer && (
        <AIMessageComposer
          customers={customers}
          onClose={() => setShowAIComposer(false)}
          onSaved={() => { queryClient.invalidateQueries({ queryKey: ['notifications'] }); setShowAIComposer(false); }}
        />
      )}
    </div>
  );
}