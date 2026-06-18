import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line
} from 'recharts';
import { ArrowLeft, User, CheckCircle2, Camera, AlertTriangle, Truck, Calendar, Clock, Fuel, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, subWeeks, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import DriverFuelEfficiencyPanel from '@/components/fuel/DriverFuelEfficiencyPanel';
import DriverProfileDetails from '@/components/driver/DriverProfileDetails';

export default function DriverDetail() {
  const params = new URLSearchParams(window.location.search);
  const driverId = params.get('id');

  const { data: driver } = useQuery({
    queryKey: ['driver', driverId],
    queryFn: () => base44.entities.User.get(driverId),
    enabled: !!driverId,
  });

  const { data: allJobs = [], isLoading } = useQuery({
    queryKey: ['driver-jobs', driverId],
    queryFn: () => base44.entities.PickupRequest.filter({ assigned_driver_id: driverId }, '-completed_at', 200),
    enabled: !!driverId,
  });

  const { data: shifts = [] } = useQuery({
    queryKey: ['driver-shifts', driverId],
    queryFn: () => base44.entities.DriverShift.filter({ driver_id: driverId }, '-clock_in', 200),
    enabled: !!driverId,
  });

  const { data: fuelLogs = [] } = useQuery({
    queryKey: ['fuel-logs'],
    queryFn: () => base44.entities.FuelLog.list('-fuel_date', 500),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const stats = useMemo(() => {
    const completed = allJobs.filter(j => j.status === 'completed');
    const completionRate = allJobs.length > 0 ? Math.round(completed.length / allJobs.length * 100) : 0;
    const jobsWithScores = completed.filter(j => j.evidence_quality_score != null);
    const avgEvidence = jobsWithScores.length > 0
      ? Math.round(jobsWithScores.reduce((s, j) => s + j.evidence_quality_score, 0) / jobsWithScores.length)
      : 0;
    const flagged = allJobs.filter(j => j.cv_flagged_for_review).length;
    const totalWeight = completed.reduce((s, j) => s + (j.actual_weight_kg || 0), 0);

    // Weekly breakdown for the last 6 weeks
    const weeklyData = Array.from({ length: 6 }).map((_, i) => {
      const weekStart = startOfWeek(subWeeks(new Date(), 5 - i));
      const weekEnd = endOfWeek(subWeeks(new Date(), 5 - i));
      const weekJobs = completed.filter(j => {
        const d = j.completed_at ? new Date(j.completed_at) : null;
        return d && isWithinInterval(d, { start: weekStart, end: weekEnd });
      });
      return {
        week: format(weekStart, 'MMM d'),
        pickups: weekJobs.length,
        weight: Math.round(weekJobs.reduce((s, j) => s + (j.actual_weight_kg || 0), 0)),
      };
    });

    // Waste type breakdown
    const wasteBreakdown = completed.reduce((acc, j) => {
      const type = j.waste_type || 'general';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
    const wasteData = Object.entries(wasteBreakdown).map(([type, count]) => ({ type, count }));

    return { completed: completed.length, total: allJobs.length, completionRate, avgEvidence, flagged, totalWeight, weeklyData, wasteData };
  }, [allJobs]);

  const scoreColor = (s) => s >= 80 ? 'text-green-600' : s >= 60 ? 'text-yellow-600' : 'text-red-500';
  const overallScore = Math.round(stats.completionRate * 0.5 + stats.avgEvidence * 0.5);

  if (!driverId) return (
    <div className="p-6 text-center text-muted-foreground">
      <p>No driver selected.</p>
      <Link to="/driver-performance"><Button variant="outline" className="mt-4">Back to Dashboard</Button></Link>
    </div>
  );

  if (isLoading) return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-48 bg-muted rounded animate-pulse" />
      <div className="grid lg:grid-cols-4 gap-4">{[1,2,3,4].map(i => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/driver-performance">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-jakarta">{driver?.full_name || driver?.email || 'Driver'}</h1>
            <p className="text-muted-foreground text-sm">{driver?.email}</p>
          </div>
        </div>
        <div className="ml-auto text-right">
          <p className={`text-3xl font-bold font-jakarta ${scoreColor(overallScore)}`}>{overallScore}</p>
          <p className="text-xs text-muted-foreground">overall score</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/60"><CardContent className="pt-5">
          <div className="flex items-center gap-2 mb-1"><CheckCircle2 className="w-4 h-4 text-green-500" /><p className="text-xs text-muted-foreground">Total Pickups</p></div>
          <p className="text-2xl font-bold font-jakarta">{stats.completed}</p>
          <p className="text-xs text-muted-foreground">{stats.total} assigned</p>
        </CardContent></Card>

        <Card className="border-border/60"><CardContent className="pt-5">
          <div className="flex items-center gap-2 mb-1"><Truck className="w-4 h-4 text-primary" /><p className="text-xs text-muted-foreground">Completion Rate</p></div>
          <p className={`text-2xl font-bold font-jakarta ${scoreColor(stats.completionRate)}`}>{stats.completionRate}%</p>
          <p className="text-xs text-muted-foreground">of assigned jobs</p>
        </CardContent></Card>

        <Card className="border-border/60"><CardContent className="pt-5">
          <div className="flex items-center gap-2 mb-1"><Camera className="w-4 h-4 text-blue-500" /><p className="text-xs text-muted-foreground">Evidence QC</p></div>
          <p className={`text-2xl font-bold font-jakarta ${scoreColor(stats.avgEvidence)}`}>{stats.avgEvidence}</p>
          <p className="text-xs text-muted-foreground">avg photo score</p>
        </CardContent></Card>

        <Card className="border-border/60"><CardContent className="pt-5">
          <div className="flex items-center gap-2 mb-1"><AlertTriangle className="w-4 h-4 text-yellow-500" /><p className="text-xs text-muted-foreground">Flagged Photos</p></div>
          <p className={`text-2xl font-bold font-jakarta ${stats.flagged > 0 ? 'text-yellow-600' : 'text-green-600'}`}>{stats.flagged}</p>
          <p className="text-xs text-muted-foreground">need review</p>
        </CardContent></Card>
      </div>

      {/* Tabbed Content */}
      <Tabs defaultValue="pickups">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="pickups"><Calendar className="w-3.5 h-3.5 mr-1.5" />Pickups</TabsTrigger>
          <TabsTrigger value="shifts"><Clock className="w-3.5 h-3.5 mr-1.5" />Shifts & Fuel</TabsTrigger>
          <TabsTrigger value="profile"><FileText className="w-3.5 h-3.5 mr-1.5" />Profile & Docs</TabsTrigger>
        </TabsList>

        {/* Pickups Tab */}
        <TabsContent value="pickups" className="mt-4 space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold font-jakarta flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" /> Weekly Pickup Activity (Last 6 Weeks)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={stats.weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="pickups" name="Pickups" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold font-jakarta">Pickups by Waste Type</CardTitle>
              </CardHeader>
              <CardContent>
                {stats.wasteData.length === 0 ? (
                  <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">No data yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={stats.wasteData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="type" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" name="Pickups" fill="hsl(38,92%,50%)" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold font-jakarta">Recent Pickups</CardTitle>
            </CardHeader>
            <CardContent>
              {allJobs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No jobs assigned yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60">
                        <th className="text-left text-xs text-muted-foreground pb-2">Date</th>
                        <th className="text-left text-xs text-muted-foreground pb-2">Address</th>
                        <th className="text-left text-xs text-muted-foreground pb-2">Waste Type</th>
                        <th className="text-left text-xs text-muted-foreground pb-2">Weight (kg)</th>
                        <th className="text-left text-xs text-muted-foreground pb-2">Status</th>
                        <th className="text-left text-xs text-muted-foreground pb-2">Evidence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {allJobs.slice(0, 20).map(j => (
                        <tr key={j.id}>
                          <td className="py-2 text-xs">{j.completed_at ? format(new Date(j.completed_at), 'MMM d, yyyy') : j.scheduled_date || '—'}</td>
                          <td className="py-2 text-xs truncate max-w-[160px]">{j.address || '—'}</td>
                          <td className="py-2 text-xs capitalize">{j.waste_type || '—'}</td>
                          <td className="py-2 text-xs">{j.actual_weight_kg ?? '—'}</td>
                          <td className="py-2"><Badge className={`text-[10px] ${j.status === 'completed' ? 'bg-green-100 text-green-700' : j.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`} variant="secondary">{j.status}</Badge></td>
                          <td className="py-2 text-xs">{j.evidence_quality_score != null ? `${j.evidence_quality_score}%` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Shifts & Fuel Tab */}
        <TabsContent value="shifts" className="mt-4">
          <DriverFuelEfficiencyPanel shifts={shifts} fuelLogs={fuelLogs} vehicles={vehicles} />
        </TabsContent>

        {/* Profile & Docs Tab */}
        <TabsContent value="profile" className="mt-4">
          <DriverProfileDetails driver={driver} driverId={driverId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}