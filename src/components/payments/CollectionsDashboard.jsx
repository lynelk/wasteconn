import { useMemo, useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { subDays, format, parseISO, isAfter } from 'date-fns';

const METHOD_COLORS = {
  cash: '#22c55e',
  mtn_momo: '#f59e0b',
  airtel_money: '#ef4444',
  bank_transfer: '#3b82f6',
  yo_payments: '#8b5cf6',
};
const METHOD_LABELS = {
  cash: 'Cash',
  mtn_momo: 'MTN MoMo',
  airtel_money: 'Airtel Money',
  bank_transfer: 'Bank Transfer',
  yo_payments: 'Yo! Payments',
};

export default function CollectionsDashboard({ payments = [] }) {
  const [range, setRange] = useState('30');

  const completed = useMemo(() => {
    const cutoff = subDays(new Date(), parseInt(range));
    return payments.filter(p => p.status === 'completed' && p.payment_date && isAfter(parseISO(p.payment_date), cutoff));
  }, [payments, range]);

  // Daily trend
  const dailyData = useMemo(() => {
    const map = {};
    completed.forEach(p => {
      const day = p.payment_date.slice(0, 10);
      map[day] = (map[day] || 0) + (p.amount_ugx || 0);
    });
    const days = parseInt(range);
    return Array.from({ length: days }, (_, i) => {
      const d = format(subDays(new Date(), days - 1 - i), 'yyyy-MM-dd');
      return { date: format(parseISO(d), 'MMM d'), amount: map[d] || 0 };
    });
  }, [completed, range]);

  // Method breakdown
  const methodData = useMemo(() => {
    const map = {};
    completed.forEach(p => {
      const m = p.payment_method || 'cash';
      map[m] = (map[m] || 0) + (p.amount_ugx || 0);
    });
    return Object.entries(map).map(([method, value]) => ({
      name: METHOD_LABELS[method] || method,
      value,
      method,
    }));
  }, [completed]);

  const totalCollected = completed.reduce((s, p) => s + (p.amount_ugx || 0), 0);

  const formatUGX = (v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold font-jakarta">Collections Overview</h2>
          <p className="text-xs text-muted-foreground">
            Total: <span className="font-semibold text-primary">{totalCollected.toLocaleString()} UGX</span> · {completed.length} payments
          </p>
        </div>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Daily Trend Chart */}
        <Card className="md:col-span-2 border-border/60">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Daily Collections (UGX)</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={dailyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={Math.floor(dailyData.length / 6)} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={formatUGX} width={42} />
                <Tooltip formatter={(v) => [`${v.toLocaleString()} UGX`, 'Collected']} labelStyle={{ fontSize: 11 }} />
                <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Payment Method Breakdown */}
        <Card className="border-border/60">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">By Method</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            {methodData.length === 0 ? (
              <div className="h-[180px] flex items-center justify-center text-muted-foreground text-xs">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={methodData} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={60} paddingAngle={2}>
                    {methodData.map((entry, i) => (
                      <Cell key={entry.method} fill={METHOD_COLORS[entry.method] || '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [`${v.toLocaleString()} UGX`]} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}