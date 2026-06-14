import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { MessageSquare, Plus, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useMyCustomer } from '@/hooks/useMyCustomer';

const statusColor = {
  open: 'bg-yellow-100 text-yellow-700',
  in_review: 'bg-blue-100 text-blue-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-600',
};
const CATEGORIES = [
  { value: 'missed_collection', label: 'Missed Collection' },
  { value: 'driver_behaviour', label: 'Driver Behaviour' },
  { value: 'billing', label: 'Billing Issue' },
  { value: 'service_quality', label: 'Service Quality' },
  { value: 'other', label: 'Other' },
];

function NewComplaintForm({ customer, onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ category: 'other', subject: '', description: '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: () => base44.entities.Complaint.create({
      customer_id: customer.id,
      tenant_id: customer.tenant_id,
      category: form.category,
      subject: form.subject,
      description: form.description,
      priority: 'medium',
      status: 'open',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-complaints', customer.id] });
      onClose();
    },
  });

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Category</Label>
        <Select value={form.category} onValueChange={v => set('category', v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Subject</Label>
        <Input value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="Brief summary" />
      </div>
      <div className="space-y-1.5">
        <Label>Description *</Label>
        <Textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Tell us what happened" rows={4} />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => mutation.mutate()} disabled={!form.description || mutation.isPending}>
          {mutation.isPending ? 'Submitting…' : 'Submit'}
        </Button>
      </div>
    </div>
  );
}

export default function MyComplaints() {
  const { data: customer, isLoading: loadingCustomer } = useMyCustomer();
  const [open, setOpen] = useState(false);

  const { data: complaints = [], isLoading } = useQuery({
    queryKey: ['my-complaints', customer?.id],
    queryFn: () => base44.entities.Complaint.filter({ customer_id: customer?.id }),
    enabled: !!customer?.id,
  });

  const sorted = [...complaints].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  const openCount = complaints.filter(c => c.status === 'open' || c.status === 'in_review').length;

  if (!loadingCustomer && !customer) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <UserX className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p>No customer account is linked to your profile.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-jakarta">My Complaints</h1>
          <p className="text-muted-foreground text-sm mt-1">{openCount} open</p>
        </div>
        <Button onClick={() => setOpen(true)} disabled={!customer} className="gap-2">
          <Plus className="w-4 h-4" /> New Complaint
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No complaints filed</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map(c => (
            <Card key={c.id} className="border-border/60">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold">{c.subject || c.category?.replace('_', ' ')}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 capitalize">{c.category?.replace('_', ' ')}</p>
                    {c.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.description}</p>}
                    {c.created_date && (
                      <p className="text-xs text-muted-foreground mt-1">{format(new Date(c.created_date), 'MMM d, yyyy')}</p>
                    )}
                    {c.status === 'resolved' && c.resolution_notes && (
                      <p className="text-xs text-green-700 mt-1">Resolution: {c.resolution_notes}</p>
                    )}
                  </div>
                  <Badge className={`text-xs ${statusColor[c.status] || ''}`} variant="secondary">
                    {c.status?.replace('_', ' ')}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-jakarta">File a Complaint</DialogTitle></DialogHeader>
          {customer && <NewComplaintForm customer={customer} onClose={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
