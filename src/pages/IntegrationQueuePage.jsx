import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { RefreshCw, AlertTriangle, CheckCircle, Clock, Zap, RotateCcw, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

const statusColor = {
  pending: 'bg-yellow-100 text-yellow-700',
  processing: 'bg-blue-100 text-blue-700',
  success: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  dead_letter: 'bg-gray-100 text-gray-800',
};

export default function IntegrationQueuePage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState('all');
  const [running, setRunning] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['integration-queue', statusFilter],
    queryFn: () => statusFilter === 'all'
      ? base44.entities.IntegrationQueue.list('-created_date', 100)
      : base44.entities.IntegrationQueue.filter({ status: statusFilter }, '-created_date', 100),
  });

  const replayMutation = useMutation({
    mutationFn: async (item) => {
      await base44.entities.IntegrationQueue.update(item.id, {
        status: 'pending',
        attempt_count: 0,
        next_retry_at: null,
        last_error: null,
        replayed_by: 'admin',
        replayed_at: new Date().toISOString(),
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['integration-queue'] }); toast({ title: 'Replayed — queued for retry' }); },
  });

  const runWorker = async () => {
    setRunning(true);
    try {
      const res = await base44.functions.invoke('integrationQueueWorker', { _scheduled: true });
      toast({ title: `Worker ran: ${res.data?.processed || 0} processed, ${res.data?.ai_classified || 0} AI classified` });
      qc.invalidateQueries({ queryKey: ['integration-queue'] });
    } catch {
      toast({ title: 'Worker failed', variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  };

  const summary = {
    pending: items.filter(i => i.status === 'pending').length,
    failed: items.filter(i => i.status === 'failed').length,
    dead_letter: items.filter(i => i.status === 'dead_letter').length,
    success: items.filter(i => i.status === 'success').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-jakarta flex items-center gap-2">
            <Zap className="w-6 h-6 text-primary" /> Integration Queue
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Outbound/inbound event queue with retries, exponential backoff, and dead-letter management
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="dead_letter">Dead Letter</SelectItem>
              <SelectItem value="success">Success</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={runWorker} disabled={running} className="gap-2">
            {running ? <><RefreshCw className="w-4 h-4 animate-spin" /> Running...</> : <><RefreshCw className="w-4 h-4" /> Run Worker</>}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-yellow-200"><CardContent className="pt-4 pb-4">
          <div className="text-2xl font-bold text-yellow-600">{summary.pending}</div>
          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Clock className="w-3 h-3" /> Pending</div>
        </CardContent></Card>
        <Card className="border-red-200"><CardContent className="pt-4 pb-4">
          <div className="text-2xl font-bold text-red-600">{summary.failed}</div>
          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><AlertTriangle className="w-3 h-3" /> Failed</div>
        </CardContent></Card>
        <Card className="border-gray-300"><CardContent className="pt-4 pb-4">
          <div className="text-2xl font-bold text-gray-700">{summary.dead_letter}</div>
          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Brain className="w-3 h-3" /> Dead Letter</div>
        </CardContent></Card>
        <Card className="border-green-200"><CardContent className="pt-4 pb-4">
          <div className="text-2xl font-bold text-green-600">{summary.success}</div>
          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><CheckCircle className="w-3 h-3" /> Success</div>
        </CardContent></Card>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i=><div key={i} className="h-16 rounded-xl bg-muted animate-pulse"/>)}</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CheckCircle className="w-10 h-10 mx-auto mb-3 opacity-30"/>
          <p>Queue is empty</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="p-4 rounded-xl border border-border/60 bg-card">
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm capitalize">{item.event_type?.replace(/_/g,' ')}</span>
                    <Badge className={`text-xs ${statusColor[item.status]}`} variant="secondary">{item.status}</Badge>
                    {item.ai_failure_class && <Badge variant="outline" className="text-xs text-primary border-primary/30"><Brain className="w-2.5 h-2.5 mr-1 inline" />{item.ai_failure_class}</Badge>}
                    {item.ai_auto_remediated && <Badge variant="outline" className="text-xs text-green-600 border-green-200">Auto-remediated</Badge>}
                    {item.signature_verified && <Badge variant="outline" className="text-xs text-green-600 border-green-200">Sig ✓</Badge>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                    <span>{item.attempt_count || 0} attempt{item.attempt_count !== 1 ? 's' : ''}</span>
                    {item.last_error && <span className="text-red-600 truncate max-w-xs">{item.last_error}</span>}
                    {item.next_retry_at && <span>Next retry: {format(new Date(item.next_retry_at), 'HH:mm')}</span>}
                    {item.ai_remediation && <span className="text-primary">AI: {item.ai_remediation}</span>}
                    <span>{item.created_date ? format(new Date(item.created_date), 'MMM d HH:mm') : '—'}</span>
                  </div>
                </div>
                {['failed','dead_letter'].includes(item.status) && (
                  <Button size="sm" variant="outline" onClick={() => replayMutation.mutate(item)} className="gap-1 text-xs shrink-0">
                    <RotateCcw className="w-3 h-3" /> Replay
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}