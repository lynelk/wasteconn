import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Upload, Star, Phone, Mail, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import HiredVehicleProviderForm from './HiredVehicleProviderForm';
import HiredVehicleImportModal from './HiredVehicleImportModal';

const mouColor = {
  'MOU Signed': 'bg-green-100 text-green-700',
  'No MOU': 'bg-red-100 text-red-700',
  'Pending': 'bg-yellow-100 text-yellow-700',
};

const statusColor = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-600',
  blacklisted: 'bg-red-100 text-red-700',
};

const availabilityLabel = {
  on_call: 'On Call', weekdays: 'Weekdays', weekends: 'Weekends', always: 'Always',
};

export default function HiredVehicleProviderList() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editProvider, setEditProvider] = useState(null);
  const [showImport, setShowImport] = useState(false);

  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['hired-providers'],
    queryFn: () => base44.entities.HiredVehicleProvider.list('-created_date', 200),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.HiredVehicleProvider.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hired-providers'] }),
  });

  const totalBilled = providers.reduce((s, p) => s + (p.total_billed_ugx || 0), 0);
  const totalTrips = providers.reduce((s, p) => s + (p.total_trips || 0), 0);
  const activeCount = providers.filter(p => p.status === 'active').length;
  const mouCount = providers.filter(p => p.mou_status === 'MOU Signed').length;

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}</div>;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border/60"><CardContent className="pt-4 pb-3">
          <div className="text-2xl font-bold font-jakarta">{providers.length}</div>
          <p className="text-xs text-muted-foreground mt-1">Total Providers</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="pt-4 pb-3">
          <div className="text-2xl font-bold font-jakarta text-green-600">{activeCount}</div>
          <p className="text-xs text-muted-foreground mt-1">Active</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="pt-4 pb-3">
          <div className="text-2xl font-bold font-jakarta">{mouCount}</div>
          <p className="text-xs text-muted-foreground mt-1">MOU Signed</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="pt-4 pb-3">
          <div className="text-sm font-bold font-jakarta">UGX {(totalBilled / 1000000).toFixed(1)}M</div>
          <p className="text-xs text-muted-foreground mt-1">Total Billed</p>
        </CardContent></Card>
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
          <Upload className="w-4 h-4" /> Import CSV
        </Button>
        <Button size="sm" onClick={() => { setEditProvider(null); setShowForm(true); }}>
          <Plus className="w-4 h-4" /> Add Provider
        </Button>
      </div>

      {/* Provider List */}
      {providers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm border border-dashed rounded-xl">
          No hired vehicle providers yet. Add your first provider or import from CSV.
        </div>
      ) : (
        <div className="space-y-3">
          {providers.map(p => (
            <Card key={p.id} className="border-border/60">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {p.provider_code && <span className="text-xs text-muted-foreground font-mono">{p.provider_code}</span>}
                      <Badge className={`text-xs ${statusColor[p.status] || ''}`} variant="secondary">{p.status}</Badge>
                      <Badge className={`text-xs ${mouColor[p.mou_status] || ''}`} variant="secondary">{p.mou_status}</Badge>
                      <span className="text-xs text-muted-foreground capitalize">{p.vehicle_type} · {availabilityLabel[p.availability] || p.availability}</span>
                    </div>
                    <p className="font-semibold text-sm">{p.client_name}</p>
                    <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-muted-foreground">
                      {p.contact_person && <span>{p.contact_person}</span>}
                      {p.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{p.phone}</span>}
                      {p.rate_per_trip_ugx > 0 && <span>UGX {p.rate_per_trip_ugx.toLocaleString()}/trip</span>}
                      {p.rate_per_day_ugx > 0 && <span>UGX {p.rate_per_day_ugx.toLocaleString()}/day</span>}
                      {p.total_trips > 0 && <span>{p.total_trips} trips</span>}
                      {p.performance_rating > 0 && (
                        <span className="flex items-center gap-0.5 text-amber-600">
                          <Star className="w-3 h-3 fill-current" />{p.performance_rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => { setEditProvider(p); setShowForm(true); }} className="p-1.5 hover:bg-muted rounded-lg">
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button onClick={() => { if (confirm('Delete this provider?')) deleteMutation.mutate(p.id); }} className="p-1.5 hover:bg-muted rounded-lg">
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <HiredVehicleProviderForm
          provider={editProvider}
          onClose={() => { setShowForm(false); setEditProvider(null); }}
        />
      )}
      {showImport && <HiredVehicleImportModal onClose={() => setShowImport(false)} />}
    </div>
  );
}