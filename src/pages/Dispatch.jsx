import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { MapPin, Truck, Plus, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import DispatchJobList from '@/components/dispatch/DispatchJobList';
import RouteBuilder from '@/components/dispatch/RouteBuilder';
import AIRouteOptimiser from '@/components/dispatch/AIRouteOptimiser';
import PredictiveExceptionEngine from '@/components/dispatch/PredictiveExceptionEngine';

export default function Dispatch() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedZone, setSelectedZone] = useState('all');
  const [selectedJobs, setSelectedJobs] = useState([]);
  const [showRouteBuilder, setShowRouteBuilder] = useState(false);

  const { data: jobs = [], isLoading: loadingJobs } = useQuery({
    queryKey: ['dispatch-jobs', selectedDate],
    queryFn: () => base44.entities.PickupRequest.filter({ scheduled_date: selectedDate }),
  });

  const { data: zones = [] } = useQuery({
    queryKey: ['zones'],
    queryFn: () => base44.entities.ServiceZone.list(),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.filter({ status: 'available' }),
  });

  const { data: routes = [] } = useQuery({
    queryKey: ['routes', selectedDate],
    queryFn: () => base44.entities.Route.filter({ route_date: selectedDate }),
  });

  // Fetch active predictive exceptions for today's jobs
  const { data: exceptions = [], refetch: refetchExceptions } = useQuery({
    queryKey: ['predictive-exceptions', selectedDate],
    queryFn: () => base44.entities.PredictiveException.filter({ prediction_date: selectedDate, status: 'predicted' }),
  });

  const unassigned = jobs.filter(j => j.status === 'pending' && !j.assigned_driver_id);
  const filteredUnassigned = selectedZone === 'all'
    ? unassigned
    : unassigned.filter(j => j.zone_id === selectedZone);

  const toggleJob = (job) => {
    setSelectedJobs(prev =>
      prev.find(j => j.id === job.id)
        ? prev.filter(j => j.id !== job.id)
        : [...prev, job]
    );
  };

  const statusCounts = {
    pending: jobs.filter(j => j.status === 'pending').length,
    assigned: jobs.filter(j => j.status === 'assigned').length,
    in_progress: jobs.filter(j => j.status === 'in_progress').length,
    completed: jobs.filter(j => j.status === 'completed').length,
  };

  // Build a set of high-risk job IDs for quick lookup
  const highRiskJobIds = new Set(
    exceptions.filter(e => e.risk_score >= 60).map(e => e.pickup_request_id)
  );
  const exceptionMap = Object.fromEntries(
    exceptions.filter(e => e.risk_score >= 60).map(e => [e.pickup_request_id, e])
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-jakarta">Dispatch Board</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Assign jobs, build routes, and optimise with AI</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="border border-input bg-background rounded-lg px-3 py-2 text-sm"
          />
          <Button onClick={() => { if (selectedJobs.length > 0) setShowRouteBuilder(true); }} disabled={selectedJobs.length === 0}>
            <Plus className="w-4 h-4" /> Build Route ({selectedJobs.length})
          </Button>
        </div>
      </div>

      {/* Status Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Unassigned', count: statusCounts.pending, color: 'bg-yellow-100 text-yellow-700' },
          { label: 'Assigned', count: statusCounts.assigned, color: 'bg-blue-100 text-blue-700' },
          { label: 'In Progress', count: statusCounts.in_progress, color: 'bg-purple-100 text-purple-700' },
          { label: 'Completed', count: statusCounts.completed, color: 'bg-green-100 text-green-700' },
        ].map(s => (
          <Card key={s.label} className="border-border/60">
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold font-jakarta">{s.count}</div>
              <Badge className={`text-xs mt-1 ${s.color}`} variant="secondary">{s.label}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Exception alert bar */}
      {exceptions.length > 0 && (
        <div className="flex items-center gap-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-300 dark:border-yellow-700 rounded-xl px-4 py-3">
          <span className="text-yellow-600 dark:text-yellow-400 font-semibold text-sm">
            ⚠ {exceptions.length} High-Risk Job{exceptions.length > 1 ? 's' : ''} Detected
          </span>
          <span className="text-xs text-muted-foreground">AI has flagged jobs below that may need proactive intervention today.</span>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Unassigned Jobs */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Unassigned Jobs</h2>
            <Select value={selectedZone} onValueChange={setSelectedZone}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue placeholder="All Zones" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Zones</SelectItem>
                {zones.map(z => <SelectItem key={z.id} value={z.id}>{z.zone_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DispatchJobList
            jobs={filteredUnassigned}
            selectedJobs={selectedJobs}
            onToggle={toggleJob}
            loading={loadingJobs}
            zones={zones}
            highRiskJobIds={highRiskJobIds}
            exceptionMap={exceptionMap}
          />
        </div>

        {/* Right Panel */}
        <div className="space-y-4">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Today's Routes</h2>
          {routes.length === 0 ? (
            <Card className="border-dashed border-border/60">
              <CardContent className="pt-6 text-center text-muted-foreground text-sm py-10">
                <Truck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No routes built yet
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {routes.map(route => (
                <Card key={route.id} className="border-border/60">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm">{route.route_name || `Route ${route.id.slice(0,6)}`}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{route.job_ids?.length || 0} jobs · {route.estimated_distance_km || '?'} km</p>
                        {route.ai_optimised && (
                          <span className="text-xs text-primary flex items-center gap-1 mt-1"><Zap className="w-3 h-3" /> AI Optimised</span>
                        )}
                      </div>
                      <Badge
                        variant="secondary"
                        className={`text-xs capitalize ${route.status === 'published' ? 'bg-green-100 text-green-700' : route.status === 'completed' ? 'bg-gray-100 text-gray-600' : 'bg-yellow-100 text-yellow-700'}`}
                      >
                        {route.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* AI Optimiser */}
          <AIRouteOptimiser
            jobs={filteredUnassigned}
            zones={zones}
            vehicles={vehicles}
            selectedDate={selectedDate}
            onOptimised={() => queryClient.invalidateQueries({ queryKey: ['routes', selectedDate] })}
          />

          {/* Predictive Exception Engine */}
          <PredictiveExceptionEngine
            jobs={jobs}
            selectedDate={selectedDate}
            onAnalysisComplete={() => refetchExceptions()}
          />
        </div>
      </div>

      {/* Route Builder Modal */}
      {showRouteBuilder && (
        <RouteBuilder
          jobs={selectedJobs}
          vehicles={vehicles}
          zones={zones}
          selectedDate={selectedDate}
          onClose={() => { setShowRouteBuilder(false); setSelectedJobs([]); }}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['routes', selectedDate] });
            queryClient.invalidateQueries({ queryKey: ['dispatch-jobs', selectedDate] });
            setShowRouteBuilder(false);
            setSelectedJobs([]);
          }}
        />
      )}
    </div>
  );
}