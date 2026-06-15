import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Download, RefreshCw, FileText, TrendingUp, Users, Truck, CreditCard, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

function exportCSV(rows, filename) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const csv = [keys.join(','), ...rows.map(r => keys.map(k => `"${r[k] ?? ''}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
}

export default function ReportingDashboard() {
  const qc = useQueryClient();
  const [period, setPeriod] = useState('monthly');
  const [generating, setGenerating] = useState(false);

  const { data: pickups = [] } = useQuery({ queryKey: ['pickups'], queryFn: () => base44.entities.PickupRequest.list('-scheduled_date', 1000) });
  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: () => base44.entities.Invoice.list('-created_date', 500) });
  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: () => base44.entities.Customer.list() });
  const { data: zones = [] } = useQuery({ queryKey: ['zones'], queryFn: () => base44.entities.ServiceZone.list() });
  const { data: tickets = [] } = useQuery({ queryKey: ['tickets'], queryFn: () => base44.entities.Ticket.list() });
  const { data: snapshots = [] } = useQuery({ queryKey: ['report-snapshots'], queryFn: () => base44.entities.ReportSnapshot.list('-created_date', 24) });

  const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.amount_ugx || 0), 0);
  const outstanding = invoices.filter(i => ['sent','overdue'].includes(i.status)).reduce((s, i) => s + (i.amount_ugx || 0), 0);
  const totalCompleted = pickups.filter(p => p.status === 'completed').length;
  const totalMissed = pickups.filter(p => p.status === 'missed').length;
  const coveragePct = pickups.length > 0 ? ((totalCompleted / pickups.length) * 100).toFixed(1) : 0;

  // Group pickups by week/month for trend chart
  const trendData = useMemo(() => {
    const grouped = {};
    pickups.slice(0, 500).forEach(p => {
      if (!p.scheduled_date) return;
      const d = new Date(p.scheduled_date);
      const key = period === 'weekly'
        ? `W${Math.ceil(d.getDate() / 7)} ${d.toLocaleString('default', { month: 'short' })}`
        : d.toLocaleString('default', { month: 'short', year: '2-digit' });
      if (!grouped[key]) grouped[key] = { period: key, completed: 0, missed: 0 };
      if (p.status === 'completed') grouped[key].completed++;
      else if (p.status === 'missed') grouped[key].missed++;
    });
    return Object.values(grouped).slice(-12);
  }, [pickups, period]);

  // Zone scorecards
  const zoneScores = useMemo(() => zones.map(z => {
    const zPickups = pickups.filter(p => p.zone_id === z.id);
    const completed = zPickups.filter(p => p.status === 'completed').length;
    const pct = zPickups.length > 0 ? Math.round((completed / zPickups.length) * 100) : 0;
    return { zone: z.zone_name, district: z.district, scheduled: zPickups.length, completed, pct };
  }).filter(z => z.scheduled > 0).sort((a, b) => b.pct - a.pct), [zones, pickups]);

  const handleGenerate = async () => {
    setGenerating(true);
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    await base44.entities.ReportSnapshot.create({
      report_type: 'monthly',
      period_label: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      period_from: from,
      period_to: to,
      total_pickups_scheduled: pickups.length,
      total_pickups_completed: totalCompleted,
      total_pickups_missed: totalMissed,
      coverage_pct: parseFloat(coveragePct),
      total_revenue_ugx: totalRevenue,
      total_outstanding_ugx: outstanding,
      active_customers: customers.filter(c => c.status === 'active').length,
      tickets_opened: tickets.length,
      tickets_resolved: tickets.filter(t => ['resolved','closed'].includes(t.status)).length,
      sla_breaches: tickets.filter(t => t.sla_breached).length,
      generated_at: new Date().toISOString(),
    });
    qc.invalidateQueries({ queryKey: ['report-snapshots'] });
    setGenerating(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-jakarta flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" /> Reporting Dashboard
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Daily/weekly/monthly export pack — coverage, tonnage, operator scorecards</p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32 h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => exportCSV(zoneScores, 'zone_scorecards.csv')}>
            <Download className="w-4 h-4" /> CSV
          </Button>
          <Button size="sm" className="gap-2" onClick={handleGenerate} disabled={generating}>
            <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Generating...' : 'Generate Snapshot'}
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Revenue (UGX)', value: totalRevenue.toLocaleString(), icon: CreditCard, color: 'text-green-600' },
          { label: 'Outstanding (UGX)', value: outstanding.toLocaleString(), icon: TrendingUp, color: 'text-red-600' },
          { label: 'Coverage Rate', value: `${coveragePct}%`, icon: Truck, color: 'text-blue-600' },
          { label: 'Active Customers', value: customers.filter(c => c.status === 'active').length, icon: Users, color: 'text-purple-600' },
        ].map(s => (
          <Card key={s.label} className="border-border/60">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className={`text-xl font-bold font-jakarta ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
                <s.icon className={`w-5 h-5 ${s.color} opacity-50`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="trends">
        <TabsList>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="scorecards">Zone Scorecards</TabsTrigger>
          <TabsTrigger value="snapshots">Saved Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="mt-4">
          <Card className="border-border/60">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Pickups Over Time</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="completed" name="Completed" fill="#22c55e" radius={[2,2,0,0]} />
                  <Bar dataKey="missed" name="Missed" fill="#ef4444" radius={[2,2,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scorecards" className="mt-4">
          <Card className="border-border/60">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2"><Award className="w-4 h-4" /> Zone Operator Scorecards</CardTitle>
              <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() => exportCSV(zoneScores, 'scorecards.csv')}>
                <Download className="w-3.5 h-3.5" /> Export
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 text-left text-xs text-muted-foreground">
                      <th className="pb-2 font-medium">#</th>
                      <th className="pb-2 font-medium">Zone</th>
                      <th className="pb-2 font-medium">District</th>
                      <th className="pb-2 font-medium">Scheduled</th>
                      <th className="pb-2 font-medium text-green-600">Completed</th>
                      <th className="pb-2 font-medium">Score</th>
                      <th className="pb-2 font-medium">Penalty (placeholder)</th>
                      <th className="pb-2 font-medium">Bonus (placeholder)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {zoneScores.map((z, i) => (
                      <tr key={i} className="border-b border-border/30 hover:bg-muted/30">
                        <td className="py-2 text-xs text-muted-foreground">{i + 1}</td>
                        <td className="py-2 font-medium text-xs">{z.zone}</td>
                        <td className="py-2 text-xs text-muted-foreground">{z.district}</td>
                        <td className="py-2 text-xs">{z.scheduled}</td>
                        <td className="py-2 text-xs text-green-600">{z.completed}</td>
                        <td className="py-2">
                          <Badge className={`text-[10px] ${z.pct >= 90 ? 'bg-green-100 text-green-700' : z.pct >= 70 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`} variant="secondary">
                            {z.pct}%
                          </Badge>
                        </td>
                        <td className="py-2 text-xs text-red-500">{z.pct < 70 ? '— (configurable)' : '—'}</td>
                        <td className="py-2 text-xs text-green-500">{z.pct >= 90 ? '— (configurable)' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="snapshots" className="mt-4 space-y-3">
          {snapshots.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No snapshots yet. Click "Generate Snapshot" to create one.</p>
            </div>
          ) : (
            snapshots.map(s => (
              <Card key={s.id} className="border-border/60">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-sm font-jakarta">{s.period_label} — {s.report_type}</p>
                      <p className="text-xs text-muted-foreground">{s.period_from} → {s.period_to}</p>
                      <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                        <span>Coverage: <strong className="text-foreground">{s.coverage_pct}%</strong></span>
                        <span>Completed: <strong className="text-foreground">{s.total_pickups_completed}</strong></span>
                        <span>Missed: <strong className="text-foreground">{s.total_pickups_missed}</strong></span>
                        <span>Revenue: <strong className="text-foreground">{(s.total_revenue_ugx || 0).toLocaleString()} UGX</strong></span>
                        <span>SLA Breaches: <strong className="text-foreground">{s.sla_breaches}</strong></span>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs capitalize">{s.report_type}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}