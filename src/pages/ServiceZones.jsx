import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, MapPin, Edit2, Trash2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ZoneForm from '@/components/zones/ZoneForm';
import ZoneCoverageAI from '@/components/zones/ZoneCoverageAI';

const DAY_LABELS = { monday:'Mon', tuesday:'Tue', wednesday:'Wed', thursday:'Thu', friday:'Fri', saturday:'Sat', sunday:'Sun' };

export default function ServiceZones() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data: zones = [], isLoading } = useQuery({
    queryKey: ['zones'],
    queryFn: () => base44.entities.ServiceZone.list(),
  });
  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: () => base44.entities.Customer.list() });

  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.ServiceZone.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['zones'] }),
  });

  const filtered = zones.filter(z =>
    z.zone_name?.toLowerCase().includes(search.toLowerCase()) ||
    z.district?.toLowerCase().includes(search.toLowerCase()) ||
    z.zone_code?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-jakarta">Service Zones</h1>
          <p className="text-muted-foreground text-sm mt-1">Define collection zones and schedules</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> Add Zone
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search zones..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{[1,2,3].map(i=><div key={i} className="h-36 rounded-xl bg-muted animate-pulse"/>)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <MapPin className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No service zones yet</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(z => {
            const zoneCustomers = customers.filter(c => c.zone_id === z.id).length;
            return (
              <Card key={z.id} className="border-border/60 hover:shadow-md transition-shadow">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold font-jakarta text-sm">{z.zone_name}</p>
                      {z.zone_code && <p className="text-xs text-muted-foreground font-mono">{z.zone_code}</p>}
                    </div>
                    <Badge variant="secondary" className={z.status === 'active' ? 'bg-green-100 text-green-700 text-xs' : 'bg-gray-100 text-gray-600 text-xs'}>
                      {z.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                    <MapPin className="w-3 h-3" />{z.district}{z.sub_county ? ` · ${z.sub_county}` : ''}
                  </div>
                  {z.collection_days?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {z.collection_days.map(d => (
                        <span key={d} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{DAY_LABELS[d]}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{zoneCustomers} customers</span>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditing(z); setOpen(true); }} className="text-muted-foreground hover:text-foreground p-1.5">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteMutation.mutate(z.id)} className="text-muted-foreground hover:text-destructive p-1.5">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ZoneCoverageAI />

      <Dialog open={open} onOpenChange={() => { setOpen(false); setEditing(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-jakarta">{editing ? 'Edit Zone' : 'Add Service Zone'}</DialogTitle>
          </DialogHeader>
          <ZoneForm zone={editing} onClose={() => { setOpen(false); setEditing(null); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}