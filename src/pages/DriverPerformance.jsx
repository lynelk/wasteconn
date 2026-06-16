import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { Award, AlertTriangle, Camera, Truck, User } from 'lucide-react';

const COLORS = ['hsl(152,60%,32%)', 'hsl(38,92%,50%)', 'hsl(210,70%,50%)', 'hsl(0,84%,60%)', 'hsl(280,65%,60%)'];

function DriverCard({ driver, stats, rank }) {
  const scoreColor = (s) => {
    if (s >= 80) return 'text-green-600';
    if (s >= 60) return 'text-yellow-600';
    return 'text-red-500';
  };

  const needsTraining = stats.overallScore < 60;

  return (
    <Card className={`border-border/60 ${needsTraining ? 'border-l-4 border-l-yellow-400' : ''}`}>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
              <User className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-sm font-jakarta">{driver.full_name || driver.email}</p>
              <p className="text-xs text-muted-foreground">{stats.totalJobs} jobs completed</p>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-2xl font-bold font-jakarta ${scoreColor(stats.overallScore)}`}>{stats.overallScore}</p>
            <p className="text-xs text-muted-foreground">overall score</p>
          </div>
        </div>

        {needsTraining && (
          <div className="flex items-center gap-2 bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400 text-xs rounded-lg px-3 py-2 mb-3">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Recommended for additional training or route adjustment
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-muted/50 rounded-lg py-2">
            <p className={`text-lg font-bold font-jakarta ${scoreColor(stats.completionRate)}`}>{stats.completionRate}%</p>
            <p className="text-[10px] text-muted-foreground">Completion</p>
          </div>
          <div className="bg-muted/50 rounded-lg py-2">
            <p className={`text-lg font-bold font-jakarta ${scoreColor(stats.avgEvidenceScore)}`}>{stats.avgEvidenceScore}</p>
            <p className="text-[10px] text-muted-foreground">Evidence QC</p>
          </div>
          <div className="bg-muted/50 rounded-lg py-2">
            <p className={`text-lg font-bold font-jakarta ${stats.exceptionRate <= 10 ? 'text-green-600' : 'text-red-500'}`}>{stats.exceptionRate}%</p>
            <p className="text-[10px] text-muted-foreground">Exception Rate</p>
          </div>
        </div>

        {stats.flaggedPhotos > 0 && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Camera className="w-3.5 h-3.5 text-red-400" />
            {stats.flaggedPhotos} photo(s) flagged for review
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DriverPerformance() {
  const { data: drivers = [], isLoading: loadingDrivers } = useQuery({
    queryKey: ['drivers-list'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: allJobs = [] } = useQuery({
    queryKey: ['all-completed-jobs'],
    queryFn: () => base44.entities.PickupRequest.filter({ status: 'completed' }, '-completed_at', 200),
  });

  const { data: exceptions = [] } = useQuery({
    queryKey: ['all-exceptions'],
    queryFn: () => base44.entities.PredictiveException.list(),
  });

  const driverStats = useMemo(() => {
    // Identify drivers from who has completed jobs (no special role needed)
    const driverIdSet = new Set(allJobs.map(j => j.assigned_driver_id).filter(Boolean));
    const driverUsers = drivers.filter(d => driverIdSet.has(d.id));

    return driverUsers.map((driver, idx) => {
      const driverJobs = allJobs.filter(j => j.assigned_driver_id === driver.id);
      const totalAssigned = driverJobs.length;
      const completed = driverJobs.filter(j => j.status === 'completed').length;
      const completionRate = totalAssigned > 0 ? Math.round(completed / totalAssigned * 100) : 0;

      // Evidence quality
      const jobsWithScores = driverJobs.filter(j => j.evidence_quality_score != null);
      const avgEvidenceScore = jobsWithScores.length > 0
        ? Math.round(jobsWithScores.reduce((s, j) => s + j.evidence_quality_score, 0) / jobsWithScores.length)
        : 0;

      const flaggedPhotos = driverJobs.filter(j => j.cv_flagged_for_review).length;

      // Exception frequency
      const driverJobIds = new Set(driverJobs.map(j => j.id));
      const driverExceptions = exceptions.filter(e => driverJobIds.has(e.pickup_request_id));
      const exceptionRate = totalAssigned > 0 ? Math.round(driverExceptions.length / totalAssigned * 100) : 0;

      // Overall score: weighted composite
      const overallScore = Math.round(
        completionRate * 0.4 +
        avgEvidenceScore * 0.3 +
        Math.max(0, 100 - exceptionRate * 2) * 0.3
      );

      return {
        driver,
        stats: { totalJobs: completed, completionRate, avgEvidenceScore, flaggedPhotos, exceptionRate, overallScore },
        color: COLORS[idx % COLORS.length],
      };
    }).sort((a, b) => b.stats.overallScore - a.stats.overallScore);
  }, [drivers, allJobs, exceptions]);

  const topPerformer = driverStats[0];
  const needsSupport = driverStats.filter(d => d.stats.overallScore < 60);

  const comparisonData = driverStats.slice(0, 6).map(d => ({
    name: d.driver.full_name?.split(' ')[0] || d.driver.email?.split('@')[0] || 'Driver',
    completion: d.stats.completionRate,
    evidence: d.stats.avgEvidenceScore,
    score: d.stats.overallScore,
  }));

  const radarData = topPerformer ? [
    { metric: 'Completion', value: topPerformer.stats.completionRate },
    { metric: 'Evidence QC', value: topPerformer.stats.avgEvidenceScore },
    { metric: 'Reliability', value: Math.max(0, 100 - topPerformer.stats.exceptionRate * 2) },
    { metric: 'Job Volume', value: Math.min(100, topPerformer.stats.totalJobs * 5) },
  ] : [];

  if (loadingDrivers) return (
    <div className="space-y-6">
      <div className="h-8 w-48 bg-muted rounded animate-pulse" />
      <div className="grid lg:grid-cols-3 gap-4">
        {[1,2,3].map(i => <div key={i} className="h-36 bg-muted rounded-xl animate-pulse" />)}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-jakarta">Driver Efficiency Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">AI-powered performance analytics for fleet managers</p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/60">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Active Drivers</p>
            <p className="text-2xl font-bold font-jakarta mt-1">{driverStats.length}</p>
            <p className="text-xs text-muted-foreground">in fleet</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Avg Efficiency</p>
            <p className="text-2xl font-bold font-jakarta text-primary mt-1">
              {driverStats.length > 0 ? Math.round(driverStats.reduce((s,d) => s + d.stats.overallScore, 0) / driverStats.length) : 0}
            </p>
            <p className="text-xs text-muted-foreground">overall score</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Flagged Evidence</p>
            <p className="text-2xl font-bold font-jakarta text-yellow-600 mt-1">
              {driverStats.reduce((s,d) => s + d.stats.flaggedPhotos, 0)}
            </p>
            <p className="text-xs text-muted-foreground">photos for review</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Need Training</p>
            <p className="text-2xl font-bold font-jakarta text-red-500 mt-1">{needsSupport.length}</p>
            <p className="text-xs text-muted-foreground">drivers flagged</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {comparisonData.length > 0 && (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold font-jakarta">Efficiency Score by Driver</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${v}%`]} />
                  <Bar dataKey="score" name="Overall Score" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
                  <Bar dataKey="evidence" name="Evidence QC" fill="hsl(38,92%,50%)" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {topPerformer && radarData.length > 0 && (
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold font-jakarta flex items-center gap-2">
                  <Award className="w-4 h-4 text-yellow-500" />
                  Top Performer: {topPerformer.driver.full_name?.split(' ')[0] || 'Driver'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={false} />
                    <Radar name="Score" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Driver Cards */}
      {driverStats.length === 0 ? (
        <Card className="border-dashed border-border/60">
          <CardContent className="py-16 text-center text-muted-foreground">
            <Truck className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No drivers found</p>
            <p className="text-xs mt-1">Assign jobs to drivers with role "driver" to see performance data here.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Individual Performance</h2>
            {needsSupport.length > 0 && (
              <Badge className="bg-yellow-100 text-yellow-700 text-xs">
                <AlertTriangle className="w-3 h-3 mr-1" />{needsSupport.length} need attention
              </Badge>
            )}
          </div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {driverStats.map(({ driver, stats }, i) => (
              <DriverCard key={driver.id} driver={driver} stats={stats} rank={i + 1} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}