import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Clock, AlertTriangle, User, MapPin, Shield } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

const STATUS_TRANSITIONS = {
  open: ['triaged', 'assigned', 'escalated', 'closed'],
  triaged: ['assigned', 'in_progress', 'escalated', 'closed'],
  assigned: ['in_progress', 'pending_evidence', 'escalated'],
  in_progress: ['pending_evidence', 'resolved', 'escalated'],
  pending_evidence: ['resolved', 'escalated'],
  escalated: ['in_progress', 'resolved', 'closed'],
  resolved: ['closed'],
};

const STATUS_COLORS = { open: 'bg-blue-100 text-blue-700', triaged: 'bg-purple-100 text-purple-700', assigned: 'bg-indigo-100 text-indigo-700', in_progress: 'bg-yellow-100 text-yellow-700', pending_evidence: 'bg-orange-100 text-orange-700', resolved: 'bg-green-100 text-green-700', closed: 'bg-gray-100 text-gray-500', escalated: 'bg-red-100 text-red-700' };

export default function TicketDetail({ ticket, customers, zones, servicePoints, onClose }) {
  const qc = useQueryClient();
  const [newStatus, setNewStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);

  const customer = customers.find(c => c.id === ticket.customer_id);
  const zone = zones.find(z => z.id === ticket.zone_id);
  const sp = servicePoints.find(s => s.id === ticket.service_point_id);

  const slaRemaining = ticket.sla_due_at ? new Date(ticket.sla_due_at) - Date.now() : null;
  const slaHoursLeft = slaRemaining ? (slaRemaining / 3600000).toFixed(1) : null;
  const slaBreached = ticket.sla_breached || slaRemaining < 0;

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Ticket.update(ticket.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tickets'] }); onClose(); },
  });

  const handleStatusChange = () => {
    if (!newStatus) return;
    const updates = { status: newStatus };
    if (notes) updates.resolution_notes = notes;
    if (newStatus === 'resolved') { updates.resolved_at = new Date().toISOString(); }
    if (newStatus === 'closed') { updates.closure_verified = true; updates.closure_verified_at = new Date().toISOString(); }
    if (newStatus === 'escalated') { updates.escalated_at = new Date().toISOString(); updates.sla_breached = true; }
    updateMutation.mutate(updates);
  };

  const handleAITriage = async () => {
    setAiLoading(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a waste management support triage specialist.
Ticket: Category="${ticket.category}", Priority="${ticket.priority}", Description="${ticket.description}"
Customer: ${customer?.full_name || 'Unknown'}, Type: ${customer?.customer_type || 'unknown'}

Return JSON with:
- ai_category: best matching category (missed_collection|billing_dispute|service_quality|access_issue|bin_damage|driver_behaviour|wrong_schedule|general_inquiry|other)
- ai_priority: suggested priority (low|medium|high|urgent)
- ai_sentiment: (positive|neutral|negative)
- ai_suggested_action: one concise action sentence`,
      response_json_schema: { type: 'object', properties: { ai_category: {type:'string'}, ai_priority:{type:'string'}, ai_sentiment:{type:'string'}, ai_suggested_action:{type:'string'} } }
    });
    setAiResult(result);
    await base44.entities.Ticket.update(ticket.id, { ...result, status: ticket.status === 'open' ? 'triaged' : ticket.status });
    qc.invalidateQueries({ queryKey: ['tickets'] });
    setAiLoading(false);
  };

  const nextStatuses = STATUS_TRANSITIONS[ticket.status] || [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge className={`text-xs ${STATUS_COLORS[ticket.status]}`} variant="secondary">{ticket.status?.replace('_',' ')}</Badge>
            <Badge variant="outline" className="text-xs capitalize">{ticket.priority}</Badge>
            <Badge variant="outline" className="text-xs">{ticket.source?.replace('_',' ')}</Badge>
          </div>
          <p className="text-sm font-medium">{ticket.subject || ticket.description?.slice(0,80)}</p>
        </div>
        {slaBreached ? (
          <Badge className="bg-red-100 text-red-700 text-xs gap-1"><AlertTriangle className="w-3 h-3" />SLA Breached</Badge>
        ) : slaHoursLeft && (
          <Badge className={`text-xs gap-1 ${Number(slaHoursLeft) < 2 ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
            <Clock className="w-3 h-3" />{slaHoursLeft}h remaining
          </Badge>
        )}
      </div>

      {/* Description */}
      <div className="bg-muted/40 rounded-lg p-3">
        <p className="text-sm">{ticket.description}</p>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="space-y-1.5">
          {customer && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <User className="w-3.5 h-3.5" />
              <span>{customer.full_name} · {customer.phone}</span>
            </div>
          )}
          {zone && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="w-3.5 h-3.5" />
              <span>{zone.zone_name}</span>
            </div>
          )}
          {sp && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="w-3.5 h-3.5 opacity-60" />
              <span>{sp.name || sp.address}</span>
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>Opened {ticket.created_date ? formatDistanceToNow(new Date(ticket.created_date), { addSuffix: true }) : '—'}</span>
          </div>
          {ticket.sla_due_at && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Shield className="w-3.5 h-3.5" />
              <span>SLA due {format(new Date(ticket.sla_due_at), 'dd MMM HH:mm')}</span>
            </div>
          )}
          {ticket.assigned_to && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <User className="w-3.5 h-3.5" />
              <span>Assigned to {ticket.assigned_to}</span>
            </div>
          )}
        </div>
      </div>

      {/* AI Triage */}
      <div className="border border-border/60 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold">AI Triage</p>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={handleAITriage} disabled={aiLoading}>
            {aiLoading ? 'Analysing...' : '⚡ Auto-triage'}
          </Button>
        </div>
        {(aiResult || ticket.ai_category) && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-muted-foreground">Category: </span><strong>{aiResult?.ai_category || ticket.ai_category}</strong></div>
            <div><span className="text-muted-foreground">Priority: </span><strong>{aiResult?.ai_priority || ticket.ai_priority}</strong></div>
            <div><span className="text-muted-foreground">Sentiment: </span><strong>{aiResult?.ai_sentiment || ticket.ai_sentiment}</strong></div>
            <div className="col-span-2"><span className="text-muted-foreground">Action: </span><strong>{aiResult?.ai_suggested_action || ticket.ai_suggested_action}</strong></div>
          </div>
        )}
      </div>

      {/* Resolution notes */}
      {ticket.resolution_notes && (
        <div>
          <Label className="text-xs">Resolution Notes</Label>
          <div className="mt-1 bg-green-50 border border-green-200 rounded-lg p-3 text-xs">{ticket.resolution_notes}</div>
        </div>
      )}

      {/* Status update */}
      {!['closed'].includes(ticket.status) && nextStatuses.length > 0 && (
        <div className="border-t border-border/50 pt-4 space-y-3">
          <p className="text-sm font-semibold">Update Status</p>
          <div className="grid grid-cols-2 gap-3">
            <Select value={newStatus || 'none'} onValueChange={v => setNewStatus(v === 'none' ? '' : v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Change status..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select new status</SelectItem>
                {nextStatuses.map(s => <SelectItem key={s} value={s}>{s.replace('_',' ')}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleStatusChange} disabled={!newStatus || updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Update'}
            </Button>
          </div>
          <Textarea rows={2} placeholder="Resolution / escalation notes..." value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
      )}

      {ticket.closure_verified && (
        <div className="flex items-center gap-2 text-green-700 text-sm bg-green-50 rounded-lg p-3">
          <CheckCircle2 className="w-4 h-4" />
          <span>Closure verified {ticket.closure_verified_at ? format(new Date(ticket.closure_verified_at), 'dd MMM yyyy HH:mm') : ''}</span>
        </div>
      )}
    </div>
  );
}