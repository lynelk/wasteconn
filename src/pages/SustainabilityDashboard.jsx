import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Leaf, Recycle, Cloud, Trash2, Scale, Download, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { computeEsg } from '@/lib/impact';

const STREAM_COLORS = {
  general: 'bg-slate-400',
  recyclable: 'bg-green-500',
  organic: 'bg-amber-500',
  hazardous: 'bg-red-500',
  bulky: 'bg-purple-500',
};

function exportCSV(rows, filename) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const csv = [keys.join(','), ...rows.map(r => keys.map(k => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// Page through an entity so lifetime ESG totals aren't silently truncated at a
// single list page. Capped for safety; the UI discloses when the cap is hit.
const PAGE = 1000;
const MAX_RECORDS = 20_000;
async function fetchAll(entity) {
  const all = [];
  for (let skip = 0; skip < MAX_RECORDS; skip += PAGE) {
    const batch = await entity.filter({}, '-created_date', PAGE, skip);
    if (!batch?.length) break;
    all.push(...batch);
    if (batch.length < PAGE) break;
  }
  return all;
}

export default function SustainabilityDashboard() {
  const { data: pickups = [], isLoading: lp } = useQuery({
    queryKey: ['esg-pickups'],
    queryFn: () => fetchAll(base44.entities.PickupRequest),
    staleTime: 120_000,
  });
  const { data: wasteBankTxns = [], isLoading: lw } = useQuery({
    queryKey: ['esg-wastebank'],
    queryFn: () => fetchAll(base44.entities.WasteBankTransaction),
    staleTime: 120_000,
  });
  const capped = pickups.length >= MAX_RECORDS || wasteBankTxns.length >= MAX_RECORDS;

  const esg = useMemo(() => computeEsg(pickups, wasteBankTxns), [pickups, wasteBankTxns]);
  const isLoading = lp || lw;

  const streamEntries = Object.entries(esg.byStream).sort((a, b) => b[1] - a[1]);
  const maxStream = streamEntries[0]?.[1] || 1;

  const headline = [
    { label: 'Diversion Rate', value: `${esg.diversionRatePct}%`, sub: 'Diverted from landfill', color: 'text-green-600', icon: Recycle },
    { label: 'Waste Diverted', value: `${(esg.divertedKg / 1000).toFixed(1)} t`, sub: `${esg.divertedKg.toLocaleString()} kg`, color: 'text-emerald-600', icon: Leaf },
    { label: 'CO₂e Avoided', value: `${esg.co2AvoidedTonnes} t`, sub: `${esg.co2AvoidedKg.toLocaleString()} kg CO₂e`, color: 'text-sky-600', icon: Cloud },
    { label: 'Recovered (Waste Bank)', value: `${esg.recoveredKg.toLocaleString()} kg`, sub: 'Recyclables bought back', color: 'text-purple-600', icon: Scale },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-jakarta flex items-center gap-2">
            <Leaf className="w-6 h-6 text-green-600" /> Sustainability & ESG
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Diversion rate · CO₂ avoided · waste-stream breakdown for ESG reporting</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => exportCSV([
            { metric: 'Collections', value: esg.collections },
            { metric: 'Total handled (kg)', value: esg.totalHandledKg },
            { metric: 'Diverted (kg)', value: esg.divertedKg },
            { metric: 'Diversion rate (%)', value: esg.diversionRatePct },
            { metric: 'CO2e avoided (kg)', value: esg.co2AvoidedKg },
            { metric: 'Recovered via waste bank (kg)', value: esg.recoveredKg },
            ...streamEntries.map(([k, v]) => ({ metric: `Stream: ${k} (kg)`, value: Math.round(v) })),
          ], 'esg_report.csv')}
        >
          <Download className="w-4 h-4" /> Export ESG Report
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[1, 2, 3, 4].map(i => <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {headline.map(s => (
              <Card key={s.label} className="border-border/60 bg-gradient-to-br from-green-50/60 to-transparent dark:from-green-950/20">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className={`text-2xl font-bold font-jakarta ${s.color}`}>{s.value}</div>
                      <div className="text-xs font-medium mt-0.5">{s.label}</div>
                      <div className="text-[10px] text-muted-foreground">{s.sub}</div>
                    </div>
                    <s.icon className={`w-5 h-5 ${s.color} opacity-50`} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Waste Stream Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {streamEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No completed collections with weight data yet.</p>
              ) : streamEntries.map(([stream, kg]) => (
                <div key={stream}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="capitalize font-medium">{stream}</span>
                    <span className="text-muted-foreground">{Math.round(kg).toLocaleString()} kg</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${STREAM_COLORS[stream] || 'bg-primary'}`} style={{ width: `${(kg / maxStream) * 100}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardContent className="pt-4 pb-4 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <Metric icon={Trash2} label="Collections completed" value={esg.collections.toLocaleString()} />
              <Metric icon={Scale} label="Total waste handled" value={`${esg.totalHandledKg.toLocaleString()} kg`} />
              <Metric icon={Recycle} label="Collected for recycling/organics" value={`${(esg.divertedKg - esg.recoveredKg).toLocaleString()} kg`} />
            </CardContent>
          </Card>

          <p className="text-[11px] text-muted-foreground">
            Estimates assume 15 kg per collection where weight data is missing and 0.5 kg CO₂e avoided per kg diverted. Connect scale/weighbridge data for audited figures.
            {capped && ` Showing the most recent ${MAX_RECORDS.toLocaleString()} records per dataset; older records are excluded from these totals.`}
          </p>
        </>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center"><Icon className="w-4 h-4 text-primary" /></div>
      <div>
        <div className="font-semibold font-jakarta">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
