import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { Zap, RefreshCw, AlertTriangle, Clock } from 'lucide-react';

const statusColor = { open:'bg-red-100 text-red-800', in_review:'bg-yellow-100 text-yellow-800', resolved:'bg-green-100 text-green-800', closed:'bg-gray-100 text-gray-600' };

export default function ComplaintDetail({ complaint, customerMap, onClose }) {
  const qc = useQueryClient();
  const customer = customerMap[complaint.customer_id];
  const [status, setStatus] = useState(complaint.status);
  const [resolution, setResolution] = useState(complaint.resolution_notes || '');
  const [classifying, setClassifying] = useState(false);
  const [aiResult, setAiResult] = useState(
    complaint.ai_sentiment ? {
      category: complaint.category,
      priority: complaint.priority,
      sentiment: complaint.ai_sentiment,
      pain_points: complaint.ai_pain_points || [],
      suggested_resolution: complaint.ai_resolution_suggestion,
      escalate_to_manager: complaint.ai_escalate,
      estimated_resolution_hours: complaint.ai_estimated_resolution_hours,
      confidence_score: complaint.ai_confidence_score,
    } : null
  );

  const handleClassify = async () => {
    setClassifying(true);
    try {
      const res = await base44.functions.invoke('aiComplaintClassifier', {
        complaint_id: complaint.id,
        subject: complaint.subject,
        description: complaint.description,
        category: complaint.category,
      });
      setAiResult(res.data?.classification);
      qc.invalidateQueries({ queryKey: ['complaints'] });
    } catch (e) {
      logger.error('complaint.classify.error', { message: e?.message });
    } finally {
      setClassifying(false);
    }
  };

  const mutation = useMutation({
    mutationFn: () => base44.entities.Complaint.update(complaint.id, {
      status,
      resolution_notes: resolution,
      resolved_at: (status === 'resolved' || status === 'closed') ? new Date().toISOString() : complaint.resolved_at,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['complaints'] }); onClose(); },
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><span className="text-muted-foreground">Customer:</span> <span className="font-medium">{customer?.full_name}</span></div>
        <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium">{customer?.phone}</span></div>
        <div><span className="text-muted-foreground">Category:</span> <span className="capitalize">{complaint.category?.replace('_',' ')}</span></div>
        <div><span className="text-muted-foreground">Date:</span> {format(new Date(complaint.created_date), 'MMM d, yyyy')}</div>
      </div>

      {complaint.subject && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">Subject</p>
          <p className="text-sm font-medium">{complaint.subject}</p>
        </div>
      )}
      <div>
        <p className="text-xs text-muted-foreground mb-1">Description</p>
        <p className="text-sm bg-muted rounded-lg p-3">{complaint.description}</p>
      </div>

      {/* AI Classification Panel */}
      <div className="bg-muted/40 rounded-xl p-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">AI Classification</p>
          <Button size="sm" variant="outline" onClick={handleClassify} disabled={classifying} className="gap-1.5 h-7 text-xs">
            {classifying ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            {classifying ? 'Classifying...' : aiResult ? 'Re-classify' : 'AI Classify'}
          </Button>
        </div>
        {aiResult && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="text-xs capitalize bg-purple-100 text-purple-700">{aiResult.category?.replace('_',' ')}</Badge>
              <Badge variant="secondary" className={`text-xs ${aiResult.priority === 'urgent' ? 'bg-red-100 text-red-700' : aiResult.priority === 'high' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>{aiResult.priority}</Badge>
              <Badge variant="secondary" className={`text-xs ${aiResult.sentiment === 'negative' ? 'bg-red-100 text-red-700' : aiResult.sentiment === 'positive' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{aiResult.sentiment}</Badge>
              {aiResult.confidence_score && <span className="text-xs text-muted-foreground">Confidence: {aiResult.confidence_score}%</span>}
            </div>
            {aiResult.pain_points?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {aiResult.pain_points.map((p, i) => <span key={i} className="text-xs bg-background border border-border rounded-full px-2 py-0.5">{p}</span>)}
              </div>
            )}
            {aiResult.suggested_resolution && (
              <p className="text-xs text-foreground bg-background border border-border rounded-lg px-3 py-2">
                <span className="text-primary font-medium">→ </span>{aiResult.suggested_resolution}
              </p>
            )}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {aiResult.estimated_resolution_hours && (
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Est. {aiResult.estimated_resolution_hours}h</span>
              )}
              {aiResult.escalate_to_manager && (
                <span className="flex items-center gap-1 text-red-600"><AlertTriangle className="w-3 h-3" /> Escalate to manager</span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border pt-4 space-y-3">
        <div className="space-y-1.5">
          <Label>Update Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_review">In Review</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Resolution Notes</Label>
          <Textarea rows={3} value={resolution} onChange={e => setResolution(e.target.value)} placeholder="Describe how this was resolved..." />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onClose}>Close</Button>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving...' : 'Save Update'}
        </Button>
      </div>
    </div>
  );
}