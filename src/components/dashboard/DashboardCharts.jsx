import { useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, subDays, parseISO } from 'date-fns';

const COLORS = ['#22963f', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#06b6d4'];

function buildDailyPickups(pickups, days = 14) {
  const counts = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = format(subDays(new Date(), i), 'MMM d');
    counts[d] = { date: d, completed: 0, pending: 0, cancelled: 0 };
  }
  pickups.forEach(p => {
    const d = format(parseISO(p.created_date), 'MMM d');
    if (counts[d]) {
      if (p.status === 'completed') counts[d].completed++;
      else if (p.status === 'pending') counts[d].pending++;
      else if (p.status === 'cancelled') counts[d].cancelled++;
    }
  });
  return Object.values(counts);
}

function buildWasteTypePie(pickups) {
  const counts = {};
  pickups.forEach(p => {
    const t = p.waste_type || 'general';
    counts[t] = (counts[t] || 0) + 1;
  });
  return Object.entries(counts).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }));
}

function buildAvgPickupTimePerZone(pickups, zones = []) {
  const zoneMetrics = {};
  pickups.forEach(p => {
    if (p.status !== 'completed' || !p.job_started_at || !p.completed_at || !p.zone_id) return;
    const duration = (new Date(p.completed_at) - new Date(p.job_started_at)) / 60000;
    if (duration <= 0 || duration > 480) return; // skip bad data
    if (!zoneMetrics[p.zone_id]) zoneMetrics[p.zone_id] = { total: 0, count: 0 };
    zoneMetrics[p.zone_id].total += duration;
    zoneMetrics[p.zone_id].count += 1;
  });
  const zoneNameMap = {};
  zones.forEach(z => { zoneNameMap[z.id] = z.name || z.id; });
  return Object.entries(zoneMetrics).map(([zoneId, data]) => ({
    zone: zoneNameMap[zoneId] || zoneId.slice(0, 8),
    avgTime: Math.round(data.total / data.count),
    jobs: data.count,
  }));
}

function buildRevenueByMonth(payments) {
  const months = {};
  payments.forEach(p => {
    if (p.status !== 'completed') return;
    const m = format(parseISO(p.created_date), 'MMM');
    months[m] = (months[m] || 0) + (p.amount_ugx || 0);
  });
  return Object.entries(months).map(([month, revenue]) => ({ month, revenue: Math.round(revenue / 1000) }));
}

export default function DashboardCharts({ pickups = [], payments = [], complaints = [], zones = [] }) {
  const dailyPickups = useMemo(() => buildDailyPickups(pickups), [pickups]);
  const wasteTypePie = useMemo(() => buildWasteTypePie(pickups), [pickups]);
  const revenueByMonth = useMemo(() => buildRevenueByMonth(payments), [payments]);
  const avgPickupTime = useMemo(() => buildAvgPickupTimePerZone(pickups, zones), [pickups, zones]);

  const complaintByCategory = useMemo(() => {
    const counts = {};
    complaints.forEach(c => {
      const k = (c.category || 'other').replace(/_/g, ' ');
      counts[k] = (counts[k] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [complaints]);

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Daily Pickup Trend */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold font-jakarta">Pickup Activity (14 days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={dailyPickups}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={2} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="completed" stroke="#22c55e" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="pending" stroke="#f59e0b" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="cancelled" stroke="#ef4444" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Revenue by Month */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold font-jakarta">Revenue by Month (UGX '000)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={revenueByMonth}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v) => [`${v}k UGX`, 'Revenue']} />
              <Bar dataKey="revenue" fill="#22963f" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Waste Type Distribution */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold font-jakarta">Waste Type Distribution</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center">
          {wasteTypePie.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={wasteTypePie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {wasteTypePie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Complaints by Category */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold font-jakarta">Complaints by Category</CardTitle>
        </CardHeader>
        <CardContent>
          {complaintByCategory.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No complaints data</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={complaintByCategory} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={100} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Bar dataKey="value" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
      {/* Avg Pickup Duration by Zone */}
      <Card className="border-border/60 lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold font-jakarta">Avg Pickup Duration by Zone (minutes)</CardTitle>
        </CardHeader>
        <CardContent>
          {avgPickupTime.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No completed pickups with timing data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={avgPickupTime}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="zone" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} unit=" min" />
                <Tooltip
                  contentStyle={{ fontSize: 11 }}
                  formatter={(v, name) => name === 'avgTime' ? [`${v} min`, 'Avg Duration'] : [v, 'Jobs']}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => v === 'avgTime' ? 'Avg Duration (min)' : 'Jobs'} />
                <Bar dataKey="avgTime" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="jobs" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}