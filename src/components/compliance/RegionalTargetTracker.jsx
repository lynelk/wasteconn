import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RadialBarChart, RadialBar, ResponsiveContainer, Tooltip } from 'recharts';
import { Target, Plus, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useState } from 'react';
import RegionalTargetForm from './RegionalTargetForm';

const statusConfig = {
  on_track: { label: 'On Track', className: 'bg-green-100 text-green-700' },
  at_risk: { label: 'At Risk', className: 'bg-yellow-100 text-yellow-700' },
  behind: { label: 'Behind', className: 'bg-red-100 text-red-700' },
  achieved: { label: 'Achieved', className: 'bg-blue-100 text-blue-700' },
};

function TargetCard({ target }) {
  const pct = target.target_value_kg > 0
    ? Math.min(100, Math.round((target.current_value_kg || 0) / target.target_value_kg * 100))
    : 0;

  const chartData = [{ name: target.region_name, value: pct, fill: pct >= 80 ? 'hsl(152,60%,32%)' : pct >= 50 ? 'hsl(38,92%,50%)' : 'hsl(0,84%,60%)' }];
  const cfg = statusConfig[target.status] || statusConfig.on_track;

  return (
    <Card className="border-border/60">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between mb-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm truncate">{target.region_name}</p>
            <p className="text-xs text-muted-foreground truncate">{target.target_name || `${target.year} Target`}</p>
          </div>
          <Badge className={`text-[10px] shrink-0 ml-2 ${cfg.className}`}>{cfg.label}</Badge>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-20 h-20 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart cx="50%" cy="50%" innerRadius="55%" outerRadius="100%" data={chartData} startAngle={90} endAngle={-270}>
                <RadialBar dataKey="value" cornerRadius={4} background={{ fill: 'hsl(var(--muted))' }} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-2xl font-bold font-jakarta text-primary">{pct}%</p>
            <p className="text-xs text-muted-foreground">{(target.current_value_kg || 0).toLocaleString()} / {target.target_value_kg.toLocaleString()} kg</p>
            <p className="text-xs text-muted-foreground mt-0.5">{target.year}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function RegionalTargetTracker() {
  const [showForm, setShowForm] = useState(false);

  const { data: targets = [], isLoading } = useQuery({
    queryKey: ['regional-targets'],
    queryFn: () => base44.entities.RegionalTarget.list('-year', 50),
  });

  const totalTarget = targets.reduce((s, t) => s + (t.target_value_kg || 0), 0);
  const totalCurrent = targets.reduce((s, t) => s + (t.current_value_kg || 0), 0);
  const overallPct = totalTarget > 0 ? Math.round(totalCurrent / totalTarget * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          <div>
            <h2 className="text-base font-semibold font-jakarta">Regional Waste Diversion Targets</h2>
            <p className="text-xs text-muted-foreground">Progress against annual goals by city/district</p>
          </div>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowForm(true)}>
          <Plus className="w-3.5 h-3.5" /> Add Target
        </Button>
      </div>

      {/* Overall summary */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Overall Platform Progress</p>
              <p className="text-3xl font-bold font-jakarta text-primary">{overallPct}%</p>
              <p className="text-xs text-muted-foreground">{totalCurrent.toLocaleString()} / {totalTarget.toLocaleString()} kg across {targets.length} regions</p>
            </div>
            <div className="text-right space-y-1">
              <p className="text-xs"><span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1"></span>{targets.filter(t => t.status === 'on_track').length} On Track</p>
              <p className="text-xs"><span className="inline-block w-2 h-2 rounded-full bg-yellow-500 mr-1"></span>{targets.filter(t => t.status === 'at_risk').length} At Risk</p>
              <p className="text-xs"><span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1"></span>{targets.filter(t => t.status === 'behind').length} Behind</p>
              <p className="text-xs"><span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1"></span>{targets.filter(t => t.status === 'achieved').length} Achieved</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1,2,3].map(i => <div key={i} className="h-36 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : targets.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
          <Target className="w-8 h-8 mx-auto mb-2 opacity-30" />
          No regional targets defined yet. Add your first target above.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {targets.map(t => <TargetCard key={t.id} target={t} />)}
        </div>
      )}

      {showForm && <RegionalTargetForm onClose={() => setShowForm(false)} />}
    </div>
  );
}