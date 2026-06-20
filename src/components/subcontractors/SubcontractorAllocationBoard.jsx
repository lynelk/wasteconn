import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckSquare, Inbox, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SubcontractorAllocationBoard() {
  const [selectedPickups, setSelectedPickups] = useState([]);
  const [selectedSubcontractor, setSelectedSubcontractor] = useState('');
  const [allocating, setAllocating] = useState(false);
  const qc = useQueryClient();

  const { data: pickups = [] } = useQuery({
    queryKey: ['pickups-unallocated'],
    queryFn: () => base44.entities.PickupRequest.filter({ status: 'pending' }, '-created_date', 50),
  });

  const { data: subcontractors = [] } = useQuery({
    queryKey: ['subcontractors-active'],
    queryFn: () => base44.entities.Subcontractor.filter({ status: 'active' }),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['subcontractor-jobs'],
    queryFn: () => base44.entities.SubcontractorJob.list('-created_date', 100),
  });

  const allocatedPickupIds = new Set(jobs.map(j => j.pickup_request_id));
  const unallocated = pickups.filter(p => !allocatedPickupIds.has(p.id));

  const toggle = (id) => setSelectedPickups(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const handleAllocate = async () => {
    if (!selectedSubcontractor || selectedPickups.length === 0) return;
    setAllocating(true);
    try {
      await base44.functions.invoke('allocateSubcontractorJob', {
        subcontractor_id: selectedSubcontractor,
        pickup_request_ids: selectedPickups,
      });
      toast.success(`${selectedPickups.length} job(s) allocated successfully`);
      setSelectedPickups([]);
      setSelectedSubcontractor('');
      qc.invalidateQueries({ queryKey: ['subcontractor-jobs'] });
      qc.invalidateQueries({ queryKey: ['pickups-unallocated'] });
    } catch (e) {
      toast.error(e.message || 'Allocation failed');
    }
    setAllocating(false);
  };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* Unallocated jobs */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Inbox className="w-4 h-4 text-muted-foreground" />
            Unallocated Pickups ({unallocated.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 max-h-96 overflow-y-auto">
          {unallocated.length === 0 && <p className="text-xs text-muted-foreground">No pending unallocated pickups.</p>}
          {unallocated.map(p => (
            <div
              key={p.id}
              onClick={() => toggle(p.id)}
              className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${selectedPickups.includes(p.id) ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}
            >
              <CheckSquare className={`w-4 h-4 mt-0.5 shrink-0 ${selectedPickups.includes(p.id) ? 'text-primary' : 'text-muted-foreground'}`} />
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{p.address || p.id}</p>
                <p className="text-xs text-muted-foreground">{p.waste_type || 'General'} · {p.scheduled_date || 'Unscheduled'}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Allocation panel */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            Allocate to Subcontractor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{selectedPickups.length} pickup(s) selected</p>
            <Select value={selectedSubcontractor} onValueChange={setSelectedSubcontractor}>
              <SelectTrigger><SelectValue placeholder="Choose subcontractor…" /></SelectTrigger>
              <SelectContent>
                {subcontractors.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.company_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-full"
            onClick={handleAllocate}
            disabled={!selectedSubcontractor || selectedPickups.length === 0 || allocating}
          >
            {allocating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Allocating…</> : `Allocate ${selectedPickups.length} Job(s)`}
          </Button>

          <div className="pt-2 border-t">
            <p className="text-xs font-medium text-muted-foreground mb-2">Recent Allocations</p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {jobs.slice(0, 10).map(j => (
                <div key={j.id} className="flex items-center justify-between text-xs p-2 rounded bg-muted/40">
                  <span className="text-muted-foreground truncate max-w-[60%]">{j.pickup_request_id?.slice(-8)}</span>
                  <Badge className={
                    j.status === 'completed' ? 'bg-green-100 text-green-700' :
                    j.status === 'disputed' ? 'bg-red-100 text-red-700' :
                    j.status === 'accepted' ? 'bg-blue-100 text-blue-700' :
                    'bg-yellow-100 text-yellow-700'
                  }>
                    {j.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}