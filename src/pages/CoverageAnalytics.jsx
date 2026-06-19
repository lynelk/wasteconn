import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { AlertTriangle, CheckCircle2, XCircle, Download, MapPin, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ANALYTICS_SCAN_LIMIT } from '@/lib/pagination';

function exportCSV(rows, filename) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const csv = [keys.join(','), ...rows.map(r => keys.map(k => `"${r[k] ?? ''}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
}

export default function CoverageAnalytics() {
  const [zoneFilter, setZoneFilter] = useState('all');
  const [dateRange, setDateRange] = useState('30');

  const { data: pickups = [] } = useQuery({ queryKey: ['pickups'], queryFn: () => base44.entities.PickupRequest.list('-route_date', 500) });
  const { data: zones = [] } = useQuery({ queryKey: ['zones'], queryFn: () => base44.entities.ServiceZone.list() });
  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: () => base44.entities.Customer.list('-created_date', ANALYTICS_SCAN_LIMIT) });
  const { data: exceptions = [] } = useQuery({ queryKey: ['exceptions'], queryFn: () => base44.entities.ExceptionQueue.list('-created_date', 200) });

  const cutoff = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - parseInt(dateRange)); return d.toISOString().split('T')[0];
  }, [dateRange]);

  const filtered = useMemo(() => pickups.filter(p => {
    const inRange = !p.route_date || p.route_date >= cutoff;
    const inZone = zoneFilter === 'all' || p.zone_id === zoneFilter;
    return inRange && inZone;
  }), [pickups, cutoff, zoneFilter]);

  const totalScheduled = filtered.length;
  const totalCompleted = filtered.filter(p => p.status === 'completed').length;
  const totalMissed = filtered.filter(p => p.status === 'missed').length;
  const coveragePct = totalScheduled > 0 ? ((totalCompleted / totalScheduled) * 100).toFixed(1) : 0;

  const zoneStats = useMemo(() => zones.map(z => {
    const zPickups = filtered.filter(p => p.zone_id === z.id);
    const served = zPickups.filter(p => p.status === 'completed').length;
    const missed = zPickups.filter(p => p.status === 'missed').length;
    const scheduled = zPickups.length;
    const repeatMisses = exceptions.filter(e => e.exception_type === 'missed_pickup' && zPickups.some(p => p.id === e.pickup_request_id)).length;
    const coveragePct = scheduled > 0 ? Math.round((served / scheduled) * 100) : 0;
    return { id: z.id, name: z.zone_name, served, missed, scheduled, repeatMisses, coveragePct, district: z.district };
  }).filter(z => z.scheduled > 0 || zoneFilter === 'all'), [zones, filtered, exceptions, zoneFilter]);

  const gapZones = zoneStats.filter(z => z.coveragePct < 60);
  const hotspots = [...zoneStats].sort((a, b) => b.missed - a.missed).slice(0, 5);

  const pieData = [
    { name: 'Completed', value: totalCompleted, fill: '#22c55e' },
    { name: 'Missed', value: totalMissed, fill: '#ef4444' },
    { name: 'Other', value: totalScheduled - totalCompleted - totalMissed, fill: '#94a3b8' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-jakarta">Coverage Analytics</h1>
          <p className="text-muted-foreground text-sm mt-1">Served/unserved by zone, gap alerts & hotspot analysis</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => exportCSV(zoneStats.map(z => ({
          Zone: z.name, District: z.district, Scheduled: z.scheduled, Served: z.served, Missed: z.missed,
          'Coverage %': z.coveragePct, 'Repeat Misses': z.repeatMisses
        })), 'coverage_analytics.csv')}>
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
        <Select value={zoneFilter} onValueChange={setZoneFilter}>
          <SelectTrigger className="w-48 h-8 text-xs"><SelectValue placeholder="All Zones" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Zones</SelectItem>
            {zones.map(z => <SelectItem key={z.id} value={z.id}>{z.zone_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Scheduled', value: totalScheduled, icon: MapPin, color: 'text-blue-600' },
          { label: 'Completed', value: totalCompleted, icon: CheckCircle2, color: 'text-green-600' },
          { label: 'Missed', value: totalMissed, icon: XCircle, color: 'text-red-600' },
          { label: 'Coverage Rate', value: `${coveragePct}%`, icon: TrendingDown, color: coveragePct >= 80 ? 'text-green-600' : 'text-orange-600' },
        ].map(s => (
          <Card key={s.label} className="border-border/60">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className={`text-2xl font-bold font-jakarta ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
                <s.icon className={`w-5 h-5 ${s.color} opacity-60`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Pie */}
        <Card className="border-border/60">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Pickup Status Breakdown</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Bar by zone */}
        <Card className="border-border/60">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Coverage % by Zone</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={zoneStats.slice(0, 10)} layout="vertical">
                <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Bar dataKey="coveragePct" radius={[0, 4, 4, 0]}>
                  {zoneStats.slice(0, 10).map((z, i) => (
                    <Cell key={i} fill={z.coveragePct >= 80 ? '#22c55e' : z.coveragePct >= 60 ? '#f59e0b' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Gap Alerts */}
      {gapZones.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-orange-700">
              <AlertTriangle className="w-4 h-4" /> Gap Alerts — Zones below 60% coverage ({gapZones.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {gapZones.map(z => (
                <Badge key={z.id} className="bg-orange-100 text-orange-800 text-xs gap-1">
                  <MapPin className="w-3 h-3" />{z.name} — {z.coveragePct}%
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hotspot Table */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Miss Hotspots (Top 5 zones by missed pickups)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Zone</th>
                  <th className="pb-2 font-medium">District</th>
                  <th className="pb-2 font-medium">Scheduled</th>
                  <th className="pb-2 font-medium text-green-600">Served</th>
                  <th className="pb-2 font-medium text-red-600">Missed</th>
                  <th className="pb-2 font-medium text-orange-600">Repeat Misses</th>
                  <th className="pb-2 font-medium">Coverage</th>
                </tr>
              </thead>
              <tbody>
                {hotspots.map(z => (
                  <tr key={z.id} className="border-b border-border/30 hover:bg-muted/30">
                    <td className="py-2 font-medium text-xs">{z.name}</td>
                    <td className="py-2 text-xs text-muted-foreground">{z.district}</td>
                    <td className="py-2 text-xs">{z.scheduled}</td>
                    <td className="py-2 text-xs text-green-600">{z.served}</td>
                    <td className="py-2 text-xs text-red-600">{z.missed}</td>
                    <td className="py-2 text-xs text-orange-600">{z.repeatMisses}</td>
                    <td className="py-2">
                      <Badge className={`text-[10px] ${z.coveragePct >= 80 ? 'bg-green-100 text-green-700' : z.coveragePct >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`} variant="secondary">
                        {z.coveragePct}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}