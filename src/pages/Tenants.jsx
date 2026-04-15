import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Building2, Edit2, Trash2, Search, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import TenantForm from '@/components/tenants/TenantForm';

const statusColor = {
  active: 'bg-green-100 text-green-700',
  suspended: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
};

export default function Tenants() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => base44.entities.Tenant.list('-created_date'),
  });

  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.Tenant.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenants'] }),
  });

  const filtered = tenants.filter(t =>
    t.company_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.district?.toLowerCase().includes(search.toLowerCase())
  );

  const handleEdit = (t) => { setEditing(t); setOpen(true); };
  const handleAdd = () => { setEditing(null); setOpen(true); };
  const handleClose = () => { setOpen(false); setEditing(null); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-jakarta">Tenants</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage waste management companies on the platform</p>
        </div>
        <Button onClick={handleAdd} className="gap-2">
          <Plus className="w-4 h-4" /> Add Tenant
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search tenants..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No tenants found</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(t => (
            <Card key={t.id} className="border-border/60 hover:shadow-md transition-shadow">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold font-jakarta text-sm">{t.company_name}</p>
                      <p className="text-xs text-muted-foreground">{t.contact_email}</p>
                    </div>
                  </div>
                  <Badge className={`text-xs ${statusColor[t.status]}`} variant="secondary">{t.status}</Badge>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-4">
                  <MapPin className="w-3 h-3" /> {t.district}
                  {t.districts_served?.length > 0 && ` +${t.districts_served.length} more`}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs capitalize">{t.subscription_plan}</Badge>
                  <div className="flex-1" />
                  <button onClick={() => handleEdit(t)} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteMutation.mutate(t.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-jakarta">{editing ? 'Edit Tenant' : 'Add New Tenant'}</DialogTitle>
          </DialogHeader>
          <TenantForm tenant={editing} onClose={handleClose} />
        </DialogContent>
      </Dialog>
    </div>
  );
}