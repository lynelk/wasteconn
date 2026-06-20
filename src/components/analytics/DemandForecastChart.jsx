import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingUp, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function DemandForecastChart() {
  const { data: forecastData, isLoading, error, refetch } = useQuery({
    queryKey: ['demand-forecast'],
    queryFn: async () => {
      const response = await base44.functions.invoke('forecastServiceDemand', {});
      return response.data;
    },
    staleTime: 1000 * 60 * 60 // 1 hour
  });

  const handleRefresh = () => {
    refetch();
    toast.info('Refreshing forecast...');
  };

  if (isLoading) {
    return (
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold font-jakarta flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            ML Demand Forecast
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground text-sm">Loading forecast...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold font-jakarta flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-destructive" />
            ML Demand Forecast
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">
            <div className="text-destructive text-sm">Failed to load forecast</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = forecastData?.forecast?.map(f => ({
    month: f.month,
    predicted_pickups: f.predicted_pickups,
    confidence: f.confidence
  })) || [];

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <div>
              <CardTitle className="text-sm font-semibold font-jakarta">ML Demand Forecast</CardTitle>
              <p className="text-xs text-muted-foreground">Next 3 months prediction</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
            No forecast data available
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: 11 }} 
                  tickFormatter={(v) => v.substring(5)} // Show MM only
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip 
                  formatter={(value) => [`${value} pickups`, 'Predicted']}
                  labelFormatter={(label) => `Month: ${label}`}
                />
                <Bar 
                  dataKey="predicted_pickups" 
                  fill="hsl(var(--primary))" 
                  radius={[4, 4, 0, 0]} 
                />
              </BarChart>
            </ResponsiveContainer>

            {forecastData?.insights && forecastData.insights.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Key Insights:</p>
                <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                  {forecastData.insights.map((insight, i) => (
                    <li key={i}>{insight}</li>
                  ))}
                </ul>
              </div>
            )}

            {forecastData?.trend && (
              <div className="mt-3 flex items-center gap-2">
                <Badge variant={forecastData.trend === 'increasing' ? 'default' : 'secondary'}>
                  Trend: {forecastData.trend}
                </Badge>
                <Badge variant="outline">
                  Avg Confidence: {Math.round(chartData.reduce((s, d) => s + d.confidence, 0) / chartData.length)}%
                </Badge>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}