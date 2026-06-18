import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, TrendingUp, Star, Fuel, MapPin, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

function ratingColor(score) {
  if (score == null) return 'text-muted-foreground';
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  if (score >= 40) return 'text-orange-600';
  return 'text-red-600';
}

function StarRating({ score }) {
  if (score == null) return <span className="text-muted-foreground text-xs">—</span>;
  const stars = Math.round(score / 20); // 0-5 stars from 0-100 score
  return (
    <span className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(s => (
        <Star key={s} className={`w-3 h-3 ${s <= stars ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
      ))}
      <span className="text-xs text-muted-foreground ml-1">({score})</span>
    </span>
  );
}

export default function DriverShiftHistoryTab({ shifts = [], pickups = [], vehicles = [] }) {
  const vehicleMap = useMemo(() => {
    const m = {};
    vehicles.forEach(v => { m[v.id] = v.registration_number || v.id.slice(0, 8); });
    return m;
  }, [vehicles]);

  // Compute per-shift stats
  const shiftStats = useMemo(() => shifts.map(s => {
    const hours = s.clock_in && s.clock_out
      ? Math.round((new Date(s.clock_out) - new Date(s.clock_in)) / 3600000 * 10) / 10
      : null;
    const distance = s.start_odometer && s.end_odometer ? Math.round(s.end_odometer - s.start_odometer) : null;
    return { ...s, hours, distance };
  }), [shifts]);

  const totalHours = shiftStats.reduce((s, sh) => s + (sh.hours || 0), 0);
  const completedShifts = shiftStats.filter(s => s.status === 'completed').length;

  // Performance ratings from pickups (evidence quality score)
  const ratedPickups = pickups.filter(p => p.evidence_quality_score != null);
  const avgPerformance = ratedPickups.length > 0
    ? Math.round(ratedPickups.reduce((s, p) => s + p.evidence_quality_score, 0) / ratedPickups.length)
    : null;

  // Monthly hours + performance chart
  const monthlyData = useMemo(() => {
    const byMonth = {};
    for (const s of shiftStats) {
      if (!s.clock_in || !s.hours) continue;
      const month = s.clock_in.slice(0, 7);
      if (!byMonth[month]) byMonth[month] = { month, hours: 0, shifts: 0 };
      byMonth[month].hours += s.hours;
      byMonth[month].shifts += 1;
    }
    // Merge avg performance per month from pickups
    const perfByMonth = {};
    for (const p of ratedPickups) {
      const d = p.completed_at || p.scheduled_date;
      if (!d) continue;
      const month = d.slice(0, 7);
      if (!perfByMonth[month]) perfByMonth[month] = [];
      perfByMonth[month].push(p.evidence_quality_score);
    }
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, data]) => ({
        label: format(parseISO(month + '-01'), 'MMM yy'),
        hours: Math.round(data.hours * 10) / 10,
        shifts: data.shifts,
        performance: perfByMonth[month]
          ? Math.round(perfByMonth[month].reduce((a, b) => a + b, 0) / perfByMonth[month].length)
          : null,
      }));
  }, [shiftStats, ratedPickups]);

  if (shifts.length === 0) {
    return (
      <Card className="border-border/60">
        <CardContent className="py-12 text-center text-muted-foreground text-sm">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
          No shift history found for this driver.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border/60"><CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-1.5 mb-1"><Calendar className="w-3.5 h-3.5 text-primary" /><p className="text-xs text-muted-foreground">Total Shifts</p></div>
          <p className="text-2xl font-bold font-jakarta">{shifts.length}</p>
          <p className="text-xs text-muted-foreground">{completedShifts} completed</p>
        </CardContent></Card>

        <Card className="border-border/60"><CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-1.5 mb-1"><Clock className="w-3.5 h-3.5 text-blue-500" /><p className="text-xs text-muted-foreground">Total Hours</p></div>
          <p className="text-2xl font-bold font-jakarta">{Math.round(totalHours * 10) / 10}h</p>
          <p className="text-xs text-muted-foreground">across all shifts</p>
        </CardContent></Card>

        <Card className="border-border/60"><CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-1.5 mb-1"><Star className="w-3.5 h-3.5 text-yellow-500" /><p className="text-xs text-muted-foreground">Performance Rating</p></div>
          <p className={`text-2xl font-bold font-jakarta ${ratingColor(avgPerformance)}`}>
            {avgPerformance != null ? `${avgPerformance}` : '—'}
          </p>
          <p className="text-xs text-muted-foreground">avg evidence score</p>
        </CardContent></Card>

        <Card className="border-border/60"><CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-1.5 mb-1"><TrendingUp className="w-3.5 h-3.5 text-green-500" /><p className="text-xs text-muted-foreground">Avg Hrs/Shift</p></div>
          <p className="text-2xl font-bold font-jakarta">
            {completedShifts > 0 ? Math.round(totalHours / completedShifts * 10) / 10 : '—'}h
          </p>
          <p className="text-xs text-muted-foreground">per completed shift</p>
        </CardContent></Card>
      </div>

      {/* Charts */}
      {monthlyData.length > 1 && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold font-jakarta flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" /> Monthly Hours Worked
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v, name) => [name === 'hours' ? `${v}h` : v, name === 'hours' ? 'Hours' : 'Shifts']} />
                  <Bar dataKey="hours" name="hours" fill="hsl(210,70%,60%)" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold font-jakarta flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-500" /> Monthly Performance Rating
              </CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyData.every(d => d.performance == null) ? (
                <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground">No performance data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [`${v}`, 'Score']} />
                    <Line type="monotone" dataKey="performance" name="Performance" stroke="hsl(38,92%,50%)" strokeWidth={2} dot={{ r: 4 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Full Shift History Table */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold font-jakarta">Complete Shift History</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60">
                <th className="text-left text-xs text-muted-foreground pb-2 pr-3">Date</th>
                <th className="text-left text-xs text-muted-foreground pb-2 pr-3">Clock In</th>
                <th className="text-left text-xs text-muted-foreground pb-2 pr-3">Clock Out</th>
                <th className="text-right text-xs text-muted-foreground pb-2 pr-3">Hours</th>
                <th className="text-right text-xs text-muted-foreground pb-2 pr-3">Distance (km)</th>
                <th className="text-left text-xs text-muted-foreground pb-2 pr-3">Vehicle</th>
                <th className="text-left text-xs text-muted-foreground pb-2 pr-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {shiftStats.map(s => (
                <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                  <td className="py-2 pr-3 text-xs whitespace-nowrap">{s.clock_in?.slice(0, 10) || '—'}</td>
                  <td className="py-2 pr-3 text-xs whitespace-nowrap">
                    {s.clock_in ? new Date(s.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                  <td className="py-2 pr-3 text-xs whitespace-nowrap">
                    {s.clock_out ? new Date(s.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : <span className="text-blue-600">Active</span>}
                  </td>
                  <td className={`py-2 pr-3 text-xs text-right font-semibold ${s.hours != null ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {s.hours != null ? `${s.hours}h` : '—'}
                  </td>
                  <td className="py-2 pr-3 text-xs text-right">{s.distance != null ? s.distance.toLocaleString() : '—'}</td>
                  <td className="py-2 pr-3 text-xs">{vehicleMap[s.vehicle_id] || '—'}</td>
                  <td className="py-2">
                    <Badge className={`text-[10px] ${s.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`} variant="secondary">
                      {s.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Performance Ratings Table */}
      {ratedPickups.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold font-jakarta flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-500" /> Individual Performance Ratings
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="text-left text-xs text-muted-foreground pb-2 pr-3">Date</th>
                  <th className="text-left text-xs text-muted-foreground pb-2 pr-3">Job / Address</th>
                  <th className="text-left text-xs text-muted-foreground pb-2 pr-3">Rating</th>
                  <th className="text-left text-xs text-muted-foreground pb-2">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {ratedPickups.slice(0, 20).map(p => (
                  <tr key={p.id} className="hover:bg-muted/20">
                    <td className="py-2 pr-3 text-xs whitespace-nowrap">
                      {p.completed_at ? format(new Date(p.completed_at), 'MMM d, yyyy') : p.scheduled_date || '—'}
                    </td>
                    <td className="py-2 pr-3 text-xs truncate max-w-[160px]">{p.address || `Job #${p.id.slice(0, 6)}`}</td>
                    <td className="py-2 pr-3">
                      <StarRating score={p.evidence_quality_score} />
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {p.cv_flagged_for_review ? <span className="text-orange-600">Flagged for review</span> : p.cv_analysis_notes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}