import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';

function SLABar({ label, value, color }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value.toFixed(1)}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  );
}

export default function SubcontractorSLAScorecard() {
  const { data: subcontractors = [] } = useQuery({
    queryKey: ['subcontractors'],
    queryFn: () => base44.entities.Subcontractor.list('-created_date', 100),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['subcontractor-jobs'],
    queryFn: () => base44.entities.SubcontractorJob.list('-created_date', 500),
  });

  const scorecards = subcontractors.map(s => {
    const myJobs = jobs.filter(j => j.subcontractor_id === s.id);
    const total = myJobs.length;
    const completed = myJobs.filter(j => j.status === 'completed').length;
    const disputed = myJobs.filter(j => j.status === 'disputed' || j.payout_status === 'disputed').length;
    const onTime = myJobs.filter(j => {
      if (j.status !== 'completed' || !j.allocated_at || !j.completed_at) return false;
      const graceDays = j.grace_period_days || 1;
      const deadline = new Date(j.allocated_at).getTime() + graceDays * 86400000;
      return new Date(j.completed_at).getTime() <= deadline;
    }).length;

    return {
      name: s.company_name,
      id: s.id,
      total,
      completionRate: total > 0 ? (completed / total) * 100 : 0,
      onTimeRate: completed > 0 ? (onTime / completed) * 100 : 0,
      disputeRate: total > 0 ? (disputed / total) * 100 : 0,
    };
  });

  const chartData = scorecards.map(s => ({
    name: s.name.length > 14 ? s.name.slice(0, 14) + '…' : s.name,
    'On-Time %': parseFloat(s.onTimeRate.toFixed(1)),
    'Completion %': parseFloat(s.completionRate.toFixed(1)),
  }));

  return (
    <div className="space-y-6">
      {scorecards.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No subcontractor data yet.</p>
      )}

      {scorecards.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Performance Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" />
                <Tooltip formatter={v => `${v}%`} />
                <Bar dataKey="On-Time %" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Completion %" fill="hsl(var(--accent))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {scorecards.map(s => (
          <Card key={s.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">{s.name}</p>
                <Badge variant="outline" className="text-xs">{s.total} jobs</Badge>
              </div>
              <SLABar label="Completion Rate" value={s.completionRate} color="bg-primary" />
              <SLABar label="On-Time Rate" value={s.onTimeRate} color={s.onTimeRate >= 80 ? 'bg-green-500' : s.onTimeRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'} />
              <SLABar label="Dispute Rate" value={s.disputeRate} color="bg-destructive" />
              <div className="flex items-center gap-1 pt-1">
                {s.onTimeRate >= 80 ? (
                  <><CheckCircle className="w-3.5 h-3.5 text-green-600" /><span className="text-xs text-green-600">Good SLA performance</span></>
                ) : s.onTimeRate >= 50 ? (
                  <><TrendingUp className="w-3.5 h-3.5 text-yellow-600" /><span className="text-xs text-yellow-600">SLA needs improvement</span></>
                ) : (
                  <><AlertTriangle className="w-3.5 h-3.5 text-red-600" /><span className="text-xs text-red-600">SLA breach risk</span></>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}