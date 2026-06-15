import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Megaphone, Send, CheckCircle, AlertCircle, Loader2, Filter } from 'lucide-react';

export default function MarketingHub() {
  const [zoneFilter, setZoneFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [message, setMessage] = useState('');
  const [senderId, setSenderId] = useState('NLSWMS');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });
  const { data: subscriptions = [] } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => base44.entities.Subscription.list(),
  });
  const { data: zones = [] } = useQuery({
    queryKey: ['zones'],
    queryFn: () => base44.entities.ServiceZone.list(),
  });

  const subStatusByCustomer = Object.fromEntries(
    subscriptions.map(s => [s.customer_id, s.status])
  );

  const filtered = customers.filter(c => {
    if (zoneFilter !== 'all' && c.zone_id !== zoneFilter) return false;
    if (statusFilter !== 'all' && subStatusByCustomer[c.id] !== statusFilter) return false;
    if (tierFilter !== 'all' && c.customer_tier !== tierFilter) return false;
    return !!c.phone;
  });

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    setResult(null);
    let sent = 0, failed = 0;
    for (const c of filtered) {
      try {
        await base44.functions.invoke('citoConnectService', {
          action: 'send_sms',
          to: c.phone,
          message,
          sender_id: senderId,
          reference: `mktg-${c.id}-${Date.now()}`,
        });
        sent++;
      } catch {
        failed++;
      }
    }
    setResult({ sent, failed, total: filtered.length });
    setSending(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-jakarta flex items-center gap-2"><Megaphone className="w-6 h-6" /> Marketing Hub</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Segment customers and send targeted bulk SMS notifications</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Segment Builder */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Filter className="w-4 h-4" /> Audience Segment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Service Zone</Label>
              <Select value={zoneFilter} onValueChange={setZoneFilter}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Zones</SelectItem>
                  {zones.map(z => <SelectItem key={z.id} value={z.id}>{z.zone_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Subscription Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Customer Tier</Label>
              <Select value={tierFilter} onValueChange={setTierFilter}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="bg-secondary/50 rounded-lg p-3 text-center mt-2">
              <p className="text-2xl font-bold font-jakarta text-primary">{filtered.length}</p>
              <p className="text-xs text-muted-foreground">customers matched</p>
              <p className="text-xs text-muted-foreground">(with phone numbers)</p>
            </div>
          </CardContent>
        </Card>

        {/* Message Composer */}
        <Card className="lg:col-span-2 border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Send className="w-4 h-4" /> Compose SMS</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Sender ID</Label>
              <Input value={senderId} onChange={e => setSenderId(e.target.value)} placeholder="NLSWMS" className="h-8 text-sm" maxLength={11} />
              <p className="text-xs text-muted-foreground">Max 11 characters alphanumeric</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Message *</Label>
              <Textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Type your SMS message here..."
                rows={5}
                maxLength={320}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{message.length} / 320 characters</span>
                <span>{message.length > 160 ? 2 : 1} SMS credit{message.length > 160 ? 's' : ''} per recipient</span>
              </div>
            </div>

            {/* Preview recipients */}
            {filtered.length > 0 && (
              <div className="border border-border/60 rounded-lg p-3">
                <p className="text-xs font-medium mb-2 text-muted-foreground">Preview Recipients ({Math.min(5, filtered.length)} of {filtered.length})</p>
                <div className="space-y-1">
                  {filtered.slice(0, 5).map(c => (
                    <div key={c.id} className="flex items-center gap-2 text-xs">
                      <span className="font-medium">{c.full_name}</span>
                      <span className="text-muted-foreground">{c.phone}</span>
                      {c.zone_id && <Badge variant="secondary" className="text-xs px-1.5 py-0">{zones.find(z => z.id === c.zone_id)?.zone_name || 'Zone'}</Badge>}
                    </div>
                  ))}
                  {filtered.length > 5 && <p className="text-xs text-muted-foreground">…and {filtered.length - 5} more</p>}
                </div>
              </div>
            )}

            {result && (
              <div className={`flex items-center gap-2 text-sm rounded-lg p-3 ${result.failed === 0 ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                {result.failed === 0 ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                Sent to {result.sent} of {result.total} recipients.
                {result.failed > 0 && ` ${result.failed} failed.`}
              </div>
            )}

            <Button
              onClick={handleSend}
              disabled={sending || filtered.length === 0 || !message.trim()}
              className="w-full gap-2"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {sending ? `Sending to ${filtered.length} customers...` : `Send to ${filtered.length} Customers`}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}