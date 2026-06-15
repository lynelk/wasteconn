import { Clock, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const wasteColor = {
  general: 'bg-gray-100 text-gray-600',
  recyclable: 'bg-green-100 text-green-700',
  organic: 'bg-lime-100 text-lime-700',
  hazardous: 'bg-red-100 text-red-700',
  bulky: 'bg-orange-100 text-orange-700',
};

export default function DispatchJobList({ jobs, selectedJobs, onToggle, loading, zones, highRiskJobIds = new Set(), exceptionMap = {} }) {
  if (loading) return (
    <div className="space-y-2">
      {[1,2,3,4].map(i => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}
    </div>
  );

  if (jobs.length === 0) return (
    <div className="text-center py-12 text-muted-foreground text-sm border border-dashed rounded-xl">
      No unassigned jobs for this date / zone
    </div>
  );

  return (
    <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
      {jobs.map(job => {
        const selected = selectedJobs.find(j => j.id === job.id);
        const zone = zones.find(z => z.id === job.zone_id);
        const isHighRisk = highRiskJobIds.has(job.id);
        const exception = exceptionMap[job.id];

        return (
          <div
            key={job.id}
            onClick={() => onToggle(job)}
            className={cn(
              "flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all",
              selected ? "border-primary bg-primary/5" : isHighRisk ? "border-yellow-400 bg-yellow-50/60 dark:bg-yellow-950/20 hover:border-yellow-500" : "border-border/60 hover:border-primary/40 bg-card"
            )}
          >
            <div className={cn(
              "w-5 h-5 mt-0.5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all",
              selected ? "bg-primary border-primary" : "border-muted-foreground/40"
            )}>
              {selected && <span className="text-white text-xs">✓</span>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={`text-xs ${wasteColor[job.waste_type] || ''}`} variant="secondary">
                  {job.waste_type}
                </Badge>
                {zone && <span className="text-xs text-muted-foreground">{zone.zone_name}</span>}
                {isHighRisk && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/50 px-2 py-0.5 rounded-full">
                    <AlertTriangle className="w-3 h-3" /> High Risk
                  </span>
                )}
              </div>
              <p className="text-sm font-medium mt-0.5 truncate">{job.address || 'No address'}</p>
              {job.scheduled_time && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3" /> {job.scheduled_time}
                </p>
              )}
              {isHighRisk && exception?.reason && (
                <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1 truncate">⚠ {exception.reason}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}