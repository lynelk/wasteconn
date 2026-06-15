import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, MessageSquare, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ComplaintForm from '@/components/complaints/ComplaintForm';
import ComplaintDetail from '@/components/complaints/ComplaintDetail';
import { useEntitiesByIds } from '@/hooks/useEntitiesByIds';
import { format } from 'date-fns';

const statusColor = { open:'bg-red-100 text-red-800', in_review:'bg-yellow-100 text-yellow-800', resolved:'bg-green-100 text-green-800', closed:'bg-gray-100 text-gray-600' };
const priorityColor = { low:'bg-blue-50 text-blue-600', medium:'bg-yellow-50 text-yellow-700', high:'bg-orange-100 text-orange-700', urgent:'bg-red-100 text-red-700' };

export default function Complaints() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [openForm, setOpenForm] = useState(false);
  const [selected, setSelected] = useState(null);

  const { data: complaints = [], isLoading } = useQuery({
    queryKey: ['complaints'],
    queryFn: () => base44.entities.Complaint.list('-created_date', 200),
  });
  // Resolve only the customers referenced by the loaded complaints (not the whole table).
  const { map: customerMap } = useEntitiesByIds('Customer', complaints.map(c => c.customer_id));

  const filtered = complaints.filter(c => {
    const cust = customerMap[c.customer_id];
    const matchSearch = cust?.full_name?.toLowerCase().includes(search.toLowerCase()) || c.subject?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || c.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-jakarta">Complaints & Feedback</h1>
          <p className="text-muted-foreground text-sm mt-1">{complaints.filter(c=>c.status==='open').length} open complaints</p>
        </div>
        <Button onClick={() => setOpenForm(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Log Complaint
        </Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search complaints..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_review">In Review</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-16 rounded-xl bg-muted animate-pulse"/>)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No complaints found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => {
            const customer = customerMap[c.customer_id];
            return (
              <div key={c.id} className="flex items-center gap-4 p-4 rounded-xl border border-border/60 bg-card hover:shadow-sm transition-shadow cursor-pointer"
                onClick={() => setSelected(c)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold text-sm">{c.subject || c.category?.replace('_',' ')}</p>
                    <Badge className={`text-xs ${priorityColor[c.priority]}`} variant="secondary">{c.priority}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {customer?.full_name || '—'} · {c.category?.replace('_',' ')} · {format(new Date(c.created_date), 'MMM d, yyyy')}
                  </p>
                </div>
                <Badge className={`text-xs ${statusColor[c.status]}`} variant="secondary">{c.status?.replace('_',' ')}</Badge>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-jakarta">Log Complaint</DialogTitle></DialogHeader>
          <ComplaintForm onClose={() => setOpenForm(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-jakarta">Complaint Detail</DialogTitle></DialogHeader>
          {selected && <ComplaintDetail complaint={selected} customerMap={customerMap} onClose={() => setSelected(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}