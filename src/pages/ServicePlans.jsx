import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ClipboardList, Edit2, Trash2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ServicePlanForm from '@/components/plans/ServicePlanForm';

const freqLabel = { daily:'Daily', twice_weekly:'2x/Week', weekly:'Weekly', biweekly:'Every 2 Weeks', monthly:'Monthly' };

export default function ServicePlans() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: () => base44.entities.ServicePlan.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.ServicePlan.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  });

  const active = plans.filter(p => p.status === 'active');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-jakarta">Service Plans</h1>
          <p className="text-muted-foreground text-sm mt-1">{active.length} active plans</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> Add Plan
        </Button>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{[1,2,3].map(i=><div key={i} className="h-44 rounded-xl bg-muted animate-pulse"/>)}</div>
      ) : plans.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No service plans yet</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {plans.map(p => (
            <Card key={p.id} className={`border-border/60 hover:shadow-md transition-shadow ${p.status === 'inactive' ? 'opacity-60' : ''}`}>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between mb-1">
                  <p className="font-bold font-jakarta text-base">{p.plan_name}</p>
                  <Badge variant="secondary" className={p.status === 'active' ? 'bg-green-100 text-green-700 text-xs' : 'bg-gray-100 text-gray-600 text-xs'}>{p.status}</Badge>
                </div>
                {p.description && <p className="text-xs text-muted-foreground mb-3">{p.description}</p>}
                <div className="flex items-end gap-1 mb-4">
                  <span className="text-2xl font-bold text-primary font-jakarta">{(p.price_ugx || 0).toLocaleString()}</span>
                  <span className="text-sm text-muted-foreground pb-0.5">UGX/{p.billing_cycle === 'monthly' ? 'mo' : p.billing_cycle}</span>
                </div>
                <div className="space-y-1.5 mb-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle className="w-3.5 h-3.5 text-primary" />
                    {freqLabel[p.frequency]} collection
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle className="w-3.5 h-3.5 text-primary" />
                    {p.max_bins || 1} bin{(p.max_bins||1) > 1 ? 's' : ''} included
                  </div>
                  {p.includes_recycling && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CheckCircle className="w-3.5 h-3.5 text-primary" />Recycling included
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs capitalize">{p.customer_type}</Badge>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditing(p); setOpen(true); }} className="text-muted-foreground hover:text-foreground p-1.5"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => deleteMutation.mutate(p.id)} className="text-muted-foreground hover:text-destructive p-1.5"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={() => { setOpen(false); setEditing(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-jakarta">{editing ? 'Edit Plan' : 'Create Service Plan'}</DialogTitle>
          </DialogHeader>
          <ServicePlanForm plan={editing} onClose={() => { setOpen(false); setEditing(null); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}