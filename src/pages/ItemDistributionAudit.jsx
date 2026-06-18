import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import {
  Package, AlertTriangle, CheckCircle, MapPin, Camera, Shield,
  RefreshCw, Eye, BarChart3, List, Filter
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid
} from 'recharts';

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-green-100 text-green-700',
  disputed: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

export default function ItemDistributionAudit() {
  const queryClient = useQueryClient();
  const [filterFlag, setFilterFlag] = useState('all'); // all | flagged | confirmed | pending
  const [runningAudit, setRunningAudit] = useState(false);
  const [auditResult, setAuditResult] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const { data: distributions = [], isLoading } = useQuery({
    queryKey: ['item-distributions'],
    queryFn: () => base44.entities.ItemDistribution.list('-distribution_date', 200),
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => base44.entities.Inventory.list(),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, notes }) => base44.entities.ItemDistribution.update(id, {
      audit_reviewed: true,
      audit_reviewed_at: new Date().toISOString(),
      audit_notes: notes,
      pilferage_flag: false,
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['item-distributions'] }),
  });

  const handleRunAudit = async () => {
    setRunningAudit(true);
    setAuditResult(null);
    const res = await base44.functions.invoke('auditItemDistributions', {});
    setAuditResult(res.data);
    queryClient.invalidateQueries({ queryKey: ['item-distributions'] });
    setRunningAudit(false);
  };

  // KPI calculations
  const totalDistributed = distributions.filter(d => d.status !== 'cancelled').length;
  const totalFlagged = distributions.filter(d => d.pilferage_flag && !d.audit_reviewed).length;
  const totalConfirmed = distributions.filter(d => d.status === 'confirmed').length;
  const totalValueUgx = distributions
    .filter(d => d.status !== 'cancelled')
    .reduce((sum, d) => sum + (d.total_value_ugx || 0), 0);

  // Inventory vs distributed comparison for chart
  const inventoryMap = {};
  for (const inv of inventory) inventoryMap[inv.id] = inv;

  const distributedByItem = {};
  for (const d of distributions.filter(d => d.status !== 'cancelled')) {
    const k = d.inventory_item_id;
    distributedByItem[k] = (distributedByItem[k] || { name: d.item_name_snapshot, distributed: 0 });
    distributedByItem[k].distributed += d.quantity || 0;
  }

  const stockComparisonData = Object.entries(distributedByItem).map(([id, val]) => ({
    name: val.name || 'Unknown',
    distributed: val.distributed,
    currentStock: inventoryMap[id]?.current_stock || 0,
  }));

  // Filter distributions
  const filtered = distributions.filter(d => {
    if (filterFlag === 'flagged') return d.pilferage_flag && !d.audit_reviewed;
    if (filterFlag === 'confirmed') return d.status === 'confirmed';
    if (filterFlag === 'pending') return d.status === 'pending';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-jakarta">Item Distribution Audit</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Track bin liners & supplies given to customers · Detect pilferage · Full audit trail
          </p>
        </div>
        <Button onClick={handleRunAudit} disabled={runningAudit} className="gap-2">
          <Shield className={`w-4 h-4 ${runningAudit ? 'animate-spin' : ''}`} />
          {runningAudit ? 'Running Audit...' : 'Run Pilferage Audit'}
        </Button>
      </div>

      {/* Audit result banner */}
      {auditResult && (
        <div className={`rounded-xl px-4 py-3 border text-sm flex items-start gap-3 ${auditResult.flagged > 0 ? 'bg-red-50 border-red-300 text-red-700' : 'bg-green-50 border-green-300 text-green-700'}`}>
          {auditResult.flagged > 0 ? <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
          <div>
            <p className="font-semibold">{auditResult.flagged > 0 ? `${auditResult.flagged} record(s) flagged` : 'Audit clean — no issues found'}</p>
            <p className="text-xs opacity-80">Checked {auditResult.checked} recent records · Slack alert sent if issues found</p>
          </div>
          <button onClick={() => setAuditResult(null)} className="ml-auto text-current opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Distributions', value: totalDistributed, icon: Package, color: 'text-blue-600' },
          { label: 'Flagged (Unreviewed)', value: totalFlagged, icon: AlertTriangle, color: 'text-red-600', highlight: totalFlagged > 0 },
          { label: 'Customer Confirmed', value: totalConfirmed, icon: CheckCircle, color: 'text-green-600' },
          { label: 'Total Value (UGX)', value: `${(totalValueUgx / 1000).toFixed(0)}K`, icon: BarChart3, color: 'text-purple-600' },
        ].map(s => (
          <Card key={s.label} className={`border-border/60 ${s.highlight ? 'border-red-300 bg-red-50 dark:bg-red-950/20' : ''}`}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <s.icon className={`w-5 h-5 ${s.color}`} />
                <div>
                  <div className="text-xl font-bold font-jakarta">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="log">
        <TabsList>
          <TabsTrigger value="log"><List className="w-3.5 h-3.5 mr-1" />Distribution Log</TabsTrigger>
          <TabsTrigger value="stock"><BarChart3 className="w-3.5 h-3.5 mr-1" />Stock vs Distributed</TabsTrigger>
        </TabsList>

        {/* Distribution Log */}
        <TabsContent value="log" className="space-y-3 mt-4">
          {/* Filter bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-muted-foreground" />
            {['all', 'flagged', 'confirmed', 'pending'].map(f => (
              <button
                key={f}
                onClick={() => setFilterFlag(f)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filterFlag === f ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-foreground'}`}
              >
                {f === 'all' ? `All (${distributions.length})` : f === 'flagged' ? `⚠️ Flagged (${totalFlagged})` : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          <Card className="border-border/60">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="py-10 text-center text-muted-foreground text-sm">Loading records...</div>
              ) : filtered.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No distribution records found.
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {filtered.map(d => (
                    <div key={d.id} className={`px-4 py-3 ${d.pilferage_flag && !d.audit_reviewed ? 'bg-red-50/60 dark:bg-red-950/10' : ''}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{d.item_name_snapshot || 'Unknown item'}</span>
                            <span className="text-xs text-muted-foreground">×{d.quantity}</span>
                            <Badge className={`text-xs ${statusColors[d.status] || 'bg-gray-100 text-gray-500'}`} variant="secondary">
                              {d.status}
                            </Badge>
                            {d.pilferage_flag && !d.audit_reviewed && (
                              <Badge className="text-xs bg-red-100 text-red-700" variant="secondary">
                                ⚠️ Flagged
                              </Badge>
                            )}
                            {d.gps_radius_breach && (
                              <Badge className="text-xs bg-orange-100 text-orange-700" variant="secondary">
                                📍 GPS Breach
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="text-xs text-muted-foreground">
                              👤 {d.customer_name_snapshot || 'Unknown customer'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              🧑‍🔧 {d.distributed_by_name_snapshot || 'Unknown staff'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              📅 {d.distribution_date ? format(new Date(d.distribution_date), 'dd MMM yyyy, HH:mm') : '—'}
                            </span>
                            {d.gps_distance_m != null && (
                              <span className={`text-xs ${d.gps_radius_breach ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
                                📍 {d.gps_distance_m}m from customer
                              </span>
                            )}
                          </div>
                          {d.pilferage_reason && !d.audit_reviewed && (
                            <div className="mt-1.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-1.5 text-xs text-red-700 dark:text-red-400">
                              {d.pilferage_reason}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {d.proof_photo_url && (
                            <a href={d.proof_photo_url} target="_blank" rel="noopener noreferrer">
                              <Camera className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                            </a>
                          )}
                          <button
                            onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Expanded detail */}
                      {expandedId === d.id && (
                        <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div><span className="text-muted-foreground">Unit Cost:</span> UGX {(d.unit_cost_snapshot_ugx || 0).toLocaleString()}</div>
                            <div><span className="text-muted-foreground">Total Value:</span> UGX {(d.total_value_ugx || 0).toLocaleString()}</div>
                            <div><span className="text-muted-foreground">GPS:</span> {d.gps_lat ? `${d.gps_lat.toFixed(5)}, ${d.gps_lng.toFixed(5)}` : 'Not captured'}</div>
                            <div><span className="text-muted-foreground">Job ID:</span> {d.pickup_request_id || '—'}</div>
                            <div><span className="text-muted-foreground">Confirmed at:</span> {d.customer_confirmation_timestamp ? format(new Date(d.customer_confirmation_timestamp), 'dd MMM HH:mm') : 'Not confirmed'}</div>
                            <div><span className="text-muted-foreground">Audit reviewed:</span> {d.audit_reviewed ? `Yes · ${d.audit_reviewed_by || ''}` : 'No'}</div>
                          </div>
                          {d.pilferage_flag && !d.audit_reviewed && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-2 text-xs gap-1"
                              onClick={() => reviewMutation.mutate({ id: d.id, notes: 'Reviewed and cleared by admin' })}
                            >
                              <CheckCircle className="w-3.5 h-3.5 text-green-600" /> Mark as Reviewed & Clear Flag
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stock vs Distributed Chart */}
        <TabsContent value="stock" className="mt-4">
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Distributed vs Current Stock by Item</CardTitle>
              <p className="text-xs text-muted-foreground">Compare total units distributed to date against remaining inventory levels</p>
            </CardHeader>
            <CardContent>
              {stockComparisonData.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">No distribution data yet.</div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stockComparisonData} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v, n) => [v, n === 'distributed' ? 'Total Distributed' : 'Current Stock']} />
                    <Legend formatter={v => v === 'distributed' ? 'Total Distributed' : 'Current Stock'} />
                    <Bar dataKey="distributed" fill="hsl(var(--chart-5))" name="distributed" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="currentStock" fill="hsl(var(--chart-1))" name="currentStock" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}