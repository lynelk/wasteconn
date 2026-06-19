import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Upload, Star, Phone, Pencil, Trash2, ChevronDown, ChevronUp, BarChart2, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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
  const [expandedId, setExpandedId] = useState(null);
  const [view, setView] = useState('list'); // 'list' | 'chart'

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

  const chartData = [...providers]
    .filter(p => p.total_billed_ugx > 0 || p.total_trips > 0)
    .sort((a, b) => (b.total_billed_ugx || 0) - (a.total_billed_ugx || 0))
    .slice(0, 8)
    .map(p => ({
      name: p.client_name.length > 12 ? p.client_name.slice(0, 12) + '…' : p.client_name,
      'Total Billed (M)': parseFloat(((p.total_billed_ugx || 0) / 1_000_000).toFixed(2)),
      'Trips': p.total_trips || 0,
      rating: p.performance_rating || 0,
    }));

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
      <div className="flex gap-2 justify-between items-center flex-wrap">
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          <button onClick={() => setView('list')} className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${view === 'list' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}>
            List
          </button>
          <button onClick={() => setView('chart')} className={`px-3 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${view === 'chart' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}>
            <BarChart2 className="w-3 h-3" /> Performance
          </button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
            <Upload className="w-4 h-4" /> Import CSV
          </Button>
          <Button size="sm" onClick={() => { setEditProvider(null); setShowForm(true); }}>
            <Plus className="w-4 h-4" /> Add Provider
          </Button>
        </div>
      </div>

      {/* Performance Chart View */}
      {view === 'chart' && (
        <div className="space-y-4">
          {chartData.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm border border-dashed rounded-xl">No billing or trip data yet.</div>
          ) : (
            <>
              <Card className="border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold font-jakarta flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" /> Billing & Trips by Provider (Top 8)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                      <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={v => `${v}M`} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v, name) => [name === 'Total Billed (M)' ? `UGX ${v}M` : v, name]} contentStyle={{ fontSize: 12, borderRadius: '0.5rem' }} />
                      <Bar yAxisId="left" dataKey="Total Billed (M)" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                      <Bar yAxisId="right" dataKey="Trips" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Performance table */}
              <Card className="border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold font-jakarta">Provider Performance Summary</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60">
                        {['Provider', 'Status', 'MOU', 'Trips', 'Total Billed', 'Rate/Trip', 'Rating', 'Last Used'].map(h => (
                          <th key={h} className="text-left text-xs text-muted-foreground pb-2 pr-3 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {[...providers].sort((a, b) => (b.total_billed_ugx || 0) - (a.total_billed_ugx || 0)).map(p => (
                        <tr key={p.id} className="hover:bg-muted/20">
                          <td className="py-2 pr-3 text-xs font-medium">{p.client_name}</td>
                          <td className="py-2 pr-3"><Badge className={`text-xs ${statusColor[p.status] || ''}`} variant="secondary">{p.status}</Badge></td>
                          <td className="py-2 pr-3"><Badge className={`text-xs ${mouColor[p.mou_status] || ''}`} variant="secondary">{p.mou_status}</Badge></td>
                          <td className="py-2 pr-3 text-xs">{p.total_trips || 0}</td>
                          <td className="py-2 pr-3 text-xs font-semibold text-primary">UGX {(p.total_billed_ugx || 0).toLocaleString()}</td>
                          <td className="py-2 pr-3 text-xs">{p.rate_per_trip_ugx > 0 ? `UGX ${p.rate_per_trip_ugx.toLocaleString()}` : '—'}</td>
                          <td className="py-2 pr-3 text-xs">
                            {p.performance_rating > 0 ? (
                              <span className="flex items-center gap-0.5 text-amber-600">
                                <Star className="w-3 h-3 fill-current" />{p.performance_rating.toFixed(1)}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="py-2 text-xs text-muted-foreground">{p.last_used_date || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Provider List */}
      {view === 'list' && (providers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm border border-dashed rounded-xl">
          No hired vehicle providers yet. Add your first provider or import from CSV.
        </div>
      ) : (
        <div className="space-y-3">
          {providers.map(p => {
            const isExpanded = expandedId === p.id;
            return (
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
                        {p.total_trips > 0 && <span className="font-medium text-foreground">{p.total_trips} trips</span>}
                        {p.total_billed_ugx > 0 && <span className="font-medium text-primary">UGX {(p.total_billed_ugx / 1_000_000).toFixed(1)}M billed</span>}
                        {p.performance_rating > 0 && (
                          <span className="flex items-center gap-0.5 text-amber-600">
                            <Star className="w-3 h-3 fill-current" />{p.performance_rating.toFixed(1)}
                          </span>
                        )}
                        {p.last_used_date && <span>Last used: {p.last_used_date}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : p.id)}
                        className="p-1.5 hover:bg-muted rounded-lg"
                        title="View details"
                      >
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                      </button>
                      <button onClick={() => { setEditProvider(p); setShowForm(true); }} className="p-1.5 hover:bg-muted rounded-lg">
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <button onClick={() => { if (confirm('Delete this provider?')) deleteMutation.mutate(p.id); }} className="p-1.5 hover:bg-muted rounded-lg">
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded service history */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-border/60 grid sm:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Billing Summary</p>
                        <p className="text-sm">Total Billed: <span className="font-semibold text-primary">UGX {(p.total_billed_ugx || 0).toLocaleString()}</span></p>
                        <p className="text-sm">Total Trips: <span className="font-semibold">{p.total_trips || 0}</span></p>
                        {p.total_trips > 0 && p.total_billed_ugx > 0 && (
                          <p className="text-sm">Avg/Trip: <span className="font-semibold">UGX {Math.round(p.total_billed_ugx / p.total_trips).toLocaleString()}</span></p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rates</p>
                        <p className="text-sm">Per Trip: {p.rate_per_trip_ugx > 0 ? `UGX ${p.rate_per_trip_ugx.toLocaleString()}` : '—'}</p>
                        <p className="text-sm">Per Day: {p.rate_per_day_ugx > 0 ? `UGX ${p.rate_per_day_ugx.toLocaleString()}` : '—'}</p>
                        <p className="text-sm">Capacity: {p.capacity || '—'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Performance</p>
                        <p className="text-sm">Rating: {p.performance_rating > 0 ? (
                          <span className="inline-flex items-center gap-0.5 text-amber-600 font-semibold">
                            <Star className="w-3 h-3 fill-current" />{p.performance_rating.toFixed(1)} / 5
                          </span>
                        ) : '—'}</p>
                        <p className="text-sm">Last Used: {p.last_used_date || '—'}</p>
                        {p.notes && <p className="text-xs text-muted-foreground mt-1 italic">"{p.notes}"</p>}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ))}

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