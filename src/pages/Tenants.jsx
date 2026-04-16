import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Building2, Edit2, Trash2, Search, MapPin, Shield, Lock, Landmark, Truck, Database } from 'lucide-react';
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

const typeColor = {
  city: 'bg-blue-100 text-blue-700',
  operator: 'bg-green-100 text-green-700',
};

export default function Tenants() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [seeding, setSeeding] = useState(false);

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => base44.entities.Tenant.list('-created_date'),
  });

  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.Tenant.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenants'] }),
  });

  const runSeed = async () => {
    setSeeding(true);
    try {
      await base44.functions.invoke('seedFoundationData', {});
      qc.invalidateQueries({ queryKey: ['tenants'] });
    } finally {
      setSeeding(false);
    }
  };

  const filtered = tenants.filter(t =>
    t.company_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.district?.toLowerCase().includes(search.toLowerCase())
  );

  const cityCount = tenants.filter(t => t.tenant_type === 'city').length;
  const operatorCount = tenants.filter(t => t.tenant_type === 'operator').length;
  const quarantinedCount = tenants.filter(t => t.quarantine_active).length;

  const handleEdit = (t) => { setEditing(t); setOpen(true); };
  const handleAdd = () => { setEditing(null); setOpen(true); };
  const handleClose = () => { setOpen(false); setEditing(null); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-jakarta">Tenants</h1>
          <p className="text-muted-foreground text-sm mt-1">Multi-tenant platform: City authorities & Operator companies</p>
        </div>
        <div className="flex gap-2">
          {tenants.length === 0 && (
            <Button variant="outline" onClick={runSeed} disabled={seeding} className="gap-2">
              <Database className={`w-4 h-4 ${seeding ? 'animate-pulse' : ''}`} />
              {seeding ? 'Seeding…' : 'Seed Foundation'}
            </Button>
          )}
          <Button onClick={handleAdd} className="gap-2">
            <Plus className="w-4 h-4" /> Add Tenant
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/60">
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center"><Landmark className="w-4 h-4 text-blue-600" /></div>
            <div><div className="text-xl font-bold font-jakarta text-blue-600">{cityCount}</div><div className="text-xs text-muted-foreground">City Authorities</div></div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center"><Truck className="w-4 h-4 text-green-600" /></div>
            <div><div className="text-xl font-bold font-jakarta text-green-600">{operatorCount}</div><div className="text-xs text-muted-foreground">Operators</div></div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center"><Shield className="w-4 h-4 text-primary" /></div>
            <div><div className="text-xl font-bold font-jakarta text-primary">{tenants.filter(t => t.isolation_enforced).length}</div><div className="text-xs text-muted-foreground">Isolated</div></div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${quarantinedCount > 0 ? 'bg-red-100' : 'bg-muted'}`}>
              <Lock className={`w-4 h-4 ${quarantinedCount > 0 ? 'text-red-600' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <div className={`text-xl font-bold font-jakarta ${quarantinedCount > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>{quarantinedCount}</div>
              <div className="text-xs text-muted-foreground">Quarantined</div>
            </div>
          </CardContent>
        </Card>
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
            <Card key={t.id} className={`border-border/60 hover:shadow-md transition-shadow ${t.quarantine_active ? 'border-red-300' : ''}`}>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${t.tenant_type === 'city' ? 'bg-blue-100' : 'bg-green-100'}`}>
                      {t.tenant_type === 'city'
                        ? <Landmark className="w-5 h-5 text-blue-600" />
                        : <Truck className="w-5 h-5 text-green-600" />}
                    </div>
                    <div>
                      <p className="font-semibold font-jakarta text-sm">{t.company_name}</p>
                      <p className="text-xs text-muted-foreground">{t.contact_email}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge className={`text-xs ${statusColor[t.status]}`} variant="secondary">{t.status}</Badge>
                    {t.health_score != null && t.health_score < 100 && (
                      <span className={`text-xs font-bold ${t.health_score >= 80 ? 'text-green-600' : t.health_score >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {t.health_score}% health
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                  <MapPin className="w-3 h-3" /> {t.district}
                  {t.districts_served?.length > 0 && ` +${t.districts_served.length} more`}
                </div>
                {t.quarantine_active && (
                  <div className="flex items-center gap-1.5 mb-3 p-2 bg-red-50 border border-red-200 rounded-md">
                    <Lock className="w-3 h-3 text-red-600" />
                    <span className="text-xs text-red-700 truncate">{t.quarantine_reason || 'Quarantined'}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Badge className={`text-xs ${typeColor[t.tenant_type] || 'bg-muted text-muted-foreground'}`} variant="secondary">
                    {t.tenant_type || 'operator'}
                  </Badge>
                  <Badge variant="outline" className="text-xs capitalize">{t.subscription_plan}</Badge>
                  {t.isolation_enforced && (
                    <Shield className="w-3 h-3 text-primary" title="Isolation enforced" />
                  )}
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