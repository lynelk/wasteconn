import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckSquare, CreditCard, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-green-700',
  disputed: 'bg-red-100 text-red-700',
};

export default function SubcontractorPayoutTab() {
  const [selected, setSelected] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('mobile_money');
  const [settling, setSettling] = useState(false);
  const qc = useQueryClient();

  const { data: jobs = [] } = useQuery({
    queryKey: ['subcontractor-jobs'],
    queryFn: () => base44.entities.SubcontractorJob.filter({ status: 'completed' }, '-completed_at', 200),
  });

  const { data: subcontractors = [] } = useQuery({
    queryKey: ['subcontractors'],
    queryFn: () => base44.entities.Subcontractor.list(),
  });

  const subMap = Object.fromEntries(subcontractors.map(s => [s.id, s.company_name]));

  const pendingJobs = jobs.filter(j => j.payout_status === 'pending');
  const paidJobs = jobs.filter(j => j.payout_status === 'paid');

  const toggle = (id) => setSelected(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const totalSelected = pendingJobs
    .filter(j => selected.includes(j.id))
    .reduce((s, j) => s + (j.payout_ugx || 0), 0);

  const handleSettle = async () => {
    if (selected.length === 0) return;
    setSettling(true);
    try {
      await base44.functions.invoke('settleSubcontractorPayout', {
        job_ids: selected,
        payment_method: paymentMethod,
      });
      toast.success(`${selected.length} job(s) settled successfully`);
      setSelected([]);
      qc.invalidateQueries({ queryKey: ['subcontractor-jobs'] });
    } catch (e) {
      toast.error(e.message || 'Settlement failed');
    }
    setSettling(false);
  };

  return (
    <div className="space-y-4">
      {/* Pending payouts */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Pending Payouts ({pendingJobs.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {pendingJobs.length === 0 && <p className="text-xs text-muted-foreground">No pending payouts.</p>}
          {pendingJobs.map(j => (
            <div
              key={j.id}
              onClick={() => toggle(j.id)}
              className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-colors ${selected.includes(j.id) ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'}`}
            >
              <div className="flex items-center gap-2">
                <CheckSquare className={`w-4 h-4 shrink-0 ${selected.includes(j.id) ? 'text-primary' : 'text-muted-foreground'}`} />
                <div>
                  <p className="text-xs font-medium">{subMap[j.subcontractor_id] || j.subcontractor_id?.slice(-8)}</p>
                  <p className="text-xs text-muted-foreground">Job {j.id.slice(-8)} · {j.completed_at?.slice(0, 10)}</p>
                </div>
              </div>
              <span className="text-sm font-semibold">UGX {(j.payout_ugx || 0).toLocaleString()}</span>
            </div>
          ))}

          {pendingJobs.length > 0 && (
            <div className="flex items-center gap-3 pt-2 border-t">
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="w-40 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" className="ml-auto" onClick={handleSettle} disabled={selected.length === 0 || settling}>
                {settling ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Settling…</> : <>
                  <CreditCard className="w-3.5 h-3.5 mr-1" />
                  Settle {selected.length > 0 ? `UGX ${totalSelected.toLocaleString()}` : ''}
                </>}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paid history */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Settled Payouts ({paidJobs.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 max-h-64 overflow-y-auto">
          {paidJobs.length === 0 && <p className="text-xs text-muted-foreground">No settled payouts yet.</p>}
          {paidJobs.map(j => (
            <div key={j.id} className="flex items-center justify-between text-xs p-2 rounded bg-muted/40">
              <span>{subMap[j.subcontractor_id] || j.subcontractor_id?.slice(-8)} · {j.completed_at?.slice(0, 10)}</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">UGX {(j.payout_ugx || 0).toLocaleString()}</span>
                <Badge className="bg-green-100 text-green-700">Paid</Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}