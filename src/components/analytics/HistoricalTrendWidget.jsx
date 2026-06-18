import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { subMonths, format } from 'date-fns';

const COLORS = ['hsl(152,60%,32%)', 'hsl(38,92%,50%)', 'hsl(210,70%,50%)', 'hsl(280,65%,60%)', 'hsl(0,84%,60%)'];

function buildMonthlyData(pickups) {
  // Build last 24 months
  const months = [];
  for (let i = 23; i >= 0; i--) {
    months.push(format(subMonths(new Date(), i), 'yyyy-MM'));
  }

  // Group by district then month
  const districtMap = {};
  pickups.forEach(p => {
    if (p.status !== 'completed') return;
    const district = p.zone_id || 'Unknown';
    const completedAt = p.completed_at || p.created_date;
    if (!completedAt) return;
    const month = completedAt.slice(0, 7);
    if (!months.includes(month)) return;
    if (!districtMap[district]) districtMap[district] = {};
    districtMap[district][month] = (districtMap[district][month] || 0) + (p.actual_weight_kg || p.estimated_weight_kg || 0);
  });

  const districts = Object.keys(districtMap).slice(0, 5); // top 5

  const chartData = months.map(month => {
    const row = { month: format(new Date(month + '-01'), 'MMM yy') };
    districts.forEach(d => { row[d] = Math.round(districtMap[d]?.[month] || 0); });
    return row;
  });

  return { chartData, districts };
}

export default function HistoricalTrendWidget() {
  const { data: pickups = [], isLoading } = useQuery({
    queryKey: ['pickups-history-24mo'],
    queryFn: () => base44.entities.PickupRequest.list('-completed_at', 2000),
  });

  const { chartData, districts } = buildMonthlyData(pickups);

  const hasData = districts.length > 0 && chartData.some(row => districts.some(d => row[d] > 0));

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <CardTitle className="text-sm font-semibold font-jakarta">Historical Waste Collection Volume (24 Months)</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">Seasonal fluctuations by district — completed pickups in kg</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-72 bg-muted animate-pulse rounded-lg" />
        ) : !hasData ? (
          <div className="h-72 flex items-center justify-center text-sm text-muted-foreground">
            No completed pickup data available for trend analysis.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} interval={2} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(1)}t` : `${v}kg`} />
              <Tooltip formatter={(v, name) => [`${v.toLocaleString()} kg`, name]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {districts.map((d, i) => (
                <Line
                  key={d}
                  type="monotone"
                  dataKey={d}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}