import { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Trash2, Search, Battery, Zap, Loader2, AlertTriangle, MapPin, Weight, FileSpreadsheet } from 'lucide-react';
import ExportButton from '@/components/export/ExportButton';
import HealthSummaryPanel from '@/components/smartbins/HealthSummaryPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { classifyFill, predictDaysToFull, summariseContainers } from '@/lib/capacityAnalytics';
import { useToast } from '@/components/ui/use-toast';

const statusStyle = {
  overflow: { bar: 'bg-red-500', badge: 'bg-red-100 text-red-700', label: 'Overflow' },
  full: { bar: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700', label: 'Full' },
  filling: { bar: 'bg-yellow-500', badge: 'bg-yellow-100 text-yellow-700', label: 'Filling' },
  ok: { bar: 'bg-green-500', badge: 'bg-green-100 text-green-700', label: 'OK' },
  unknown: { bar: 'bg-gray-300', badge: 'bg-gray-100 text-gray-500', label: 'No signal' },
};

function KpiCard({ label, value, accent }) {
  return (
    <Card className="border-border/60">
      <CardContent className="pt-5 pb-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold font-jakarta mt-1 ${accent || ''}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

export default function SmartBins() {
  const [search, setSearch] = useState('');
  const [plan, setPlan] = useState(null);
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const handleSheetsExport = async () => {
    setExporting(true);
    try {
      const res = await base44.functions.invoke('exportMaintenanceToSheets', {});
      const { spreadsheetUrl, rowsExported } = res.data;
      toast({ title: 'Exported to Google Sheets', description: `${rowsExported} assets exported. Opening sheet...` });
      window.open(spreadsheetUrl, '_blank');
    } catch (err) {
      toast({ title: 'Export failed', description: err.message, variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const { data: containers = [], isLoading } = useQuery({
    queryKey: ['containers'],
    queryFn: () => base44.entities.Container.list(),
  });

  const summary = useMemo(() => summariseContainers(containers), [containers]);

  const planMutation = useMutation({
    mutationFn: () => base44.functions.invoke('fillLevelRouteOptimiser', {}),
    onSuccess: (res) => setPlan(res),
  });

  const filtered = containers.filter((c) =>
    [c.label, c.qr_code, c.waste_stream].some((f) => f?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-jakarta">Smart Bins</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {summary.needsCollection} of {summary.total} assets due for collection · {summary.bins} bins, {summary.skips} skips
          </p>
        </div>
        <div className="flex gap-2">
          <ExportButton
            title="Containers"
            columns={[
              { label: 'Label', key: 'label' },
              { label: 'Waste Stream', key: 'waste_stream' },
              { label: 'Capacity (L)', key: 'capacity_litres' },
              { label: 'Fill %', key: 'last_fill_pct' },
              { label: 'Battery %', key: 'last_battery_pct' },
              { label: 'Last Reading', key: 'last_reading_at' },
              { label: 'Status', key: 'status' },
            ]}
            rows={containers}
          />
          <Button onClick={handleSheetsExport} disabled={exporting} variant="outline" className="gap-2">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            Export to Sheets
          </Button>
          <Button onClick={() => planMutation.mutate()} disabled={planMutation.isPending} className="gap-2">
            {planMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Generate Collection Plan
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
        <KpiCard label="Total assets" value={summary.total} />
        <KpiCard label="Smart bins" value={summary.bins} />
        <KpiCard label="Skips" value={summary.skips} />
        <KpiCard label="Due now" value={summary.needsCollection} accent="text-primary" />
        <KpiCard label="Overflowing" value={summary.overflow} accent="text-red-600" />
        <KpiCard label="Filling" value={summary.filling} accent="text-yellow-600" />
        <KpiCard label="No signal" value={summary.unknown} accent="text-muted-foreground" />
      </div>

      {plan && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="pt-5 pb-4">
            <p className="font-semibold text-sm font-jakarta mb-2">{plan.summary}</p>
            {(plan.plans || []).map((p, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                <MapPin className="w-3.5 h-3.5" />
                <span className="font-medium text-foreground">Zone {p.zone_id}</span>
                <span>· {p.stops} stops · {p.estimated_distance_km} km · ~{p.estimated_duration_mins} min</span>
                {p.isolation_required && <Badge className="bg-red-100 text-red-700 text-[10px]" variant="secondary">hazardous</Badge>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <HealthSummaryPanel containers={containers} />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search bins..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-36 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Trash2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No containers yet</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const status = classifyFill(c.last_fill_pct);
            const style = statusStyle[status];
            const fill = typeof c.last_fill_pct === 'number' ? Math.max(0, Math.min(100, c.last_fill_pct)) : 0;
            const daysToFull = predictDaysToFull(c.last_fill_pct, c.avg_daily_fill_rate_pct);
            return (
              <Card key={c.id} className="border-border/60 hover:shadow-md transition-shadow">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold font-jakarta text-sm">{c.label || c.qr_code || c.id}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {c.waste_stream}
                        {c.asset_category === 'skip'
                          ? c.max_weight_kg ? ` · ${c.max_weight_kg} kg cap` : ''
                          : c.capacity_litres ? ` · ${c.capacity_litres}L` : ''}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge className={`text-xs ${style.badge}`} variant="secondary">{style.label}</Badge>
                      {c.asset_category === 'skip' && (
                        <Badge className="text-[10px] bg-blue-100 text-blue-700" variant="secondary">Skip</Badge>
                      )}
                    </div>
                  </div>

                  <div className="mb-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Fill level</span>
                      <span className="font-semibold">{typeof c.last_fill_pct === 'number' ? `${Math.round(c.last_fill_pct)}%` : '—'}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full ${style.bar} transition-all`} style={{ width: `${fill}%` }} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-3">
                    {c.asset_category === 'skip' ? (
                      <span className="flex items-center gap-1">
                        <Weight className="w-3.5 h-3.5" />
                        {typeof c.last_weight_kg === 'number' ? `${c.last_weight_kg} kg` : '—'}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Battery className="w-3.5 h-3.5" />
                        {typeof c.last_battery_pct === 'number' ? `${Math.round(c.last_battery_pct)}%` : '—'}
                      </span>
                    )}
                    {status === 'overflow' ? (
                      <span className="flex items-center gap-1 text-red-600 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5" /> Overflowing
                      </span>
                    ) : daysToFull !== null ? (
                      <span>{daysToFull === 0 ? 'Full now' : `~${daysToFull}d to full`}</span>
                    ) : (
                      <span>No forecast</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}