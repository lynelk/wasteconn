import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';

const statusColor = { open:'bg-red-100 text-red-800', in_review:'bg-yellow-100 text-yellow-800', resolved:'bg-green-100 text-green-800', closed:'bg-gray-100 text-gray-600' };

export default function ComplaintDetail({ complaint, customerMap, onClose }) {
  const qc = useQueryClient();
  const customer = customerMap[complaint.customer_id];
  const [status, setStatus] = useState(complaint.status);
  const [resolution, setResolution] = useState(complaint.resolution_notes || '');

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