import { useState, useRef } from 'react';
import { MapPin, Camera, ChevronDown, ChevronUp, CheckCircle2, Play, AlertTriangle, Star, MapPinOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import NavigationAssist, { recordJobCompletion } from '@/components/driver/NavigationAssist';
import LocationCorrectionModal from '@/components/driver/LocationCorrectionModal';
import { getBreadcrumbs, clearBreadcrumbs, estimateDistanceKm } from '@/components/driver/GPSBreadcrumbTracker';

const statusConfig = {
  pending:     { label: 'Pending',     color: 'bg-gray-700 text-gray-300' },
  assigned:    { label: 'Assigned',    color: 'bg-blue-900 text-blue-300' },
  in_progress: { label: 'In Progress', color: 'bg-yellow-900 text-yellow-300' },
  completed:   { label: 'Completed',   color: 'bg-green-900 text-green-300' },
  cancelled:   { label: 'Cancelled',   color: 'bg-red-900 text-red-300' },
};

const wasteColor = {
  general: 'text-gray-400', recyclable: 'text-green-400',
  organic: 'text-lime-400', hazardous: 'text-red-400', bulky: 'text-orange-400',
};

export default function DriverJobCard({ job, onStatusUpdate, onPhotoUpload }) {
  const [expanded, setExpanded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showLocationCorrection, setShowLocationCorrection] = useState(false);
  const [startedAt] = useState(() => job.status === 'in_progress' ? (localStorage.getItem(`job_start_${job.id}`) || null) : null);
  const [routeFeedback, setRouteFeedback] = useState(null);
  const [breadcrumbs, setBreadcrumbs] = useState(() => job.status === 'in_progress' ? getBreadcrumbs(job.id) : []);
  const fileRef = useRef();

  const cfg = statusConfig[job.status] || statusConfig.assigned;

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    await onPhotoUpload(job, files);
    setUploading(false);
  };

  const openMaps = () => {
    if (job.address) window.open(`https://maps.google.com/?q=${encodeURIComponent(job.address)}`, '_blank');
  };

  return (
    <div className={cn(
      "bg-gray-800 rounded-xl border transition-all",
      job.status === 'in_progress' ? 'border-yellow-600' : 'border-gray-700'
    )}>
      {/* Main row */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn("text-xs font-medium capitalize", wasteColor[job.waste_type] || 'text-gray-400')}>
                {job.waste_type} waste
              </span>
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", cfg.color)}>
                {cfg.label}
              </span>
            </div>
            <p className="text-sm font-semibold text-white truncate">{job.address || 'No address provided'}</p>
            {job.scheduled_time && (
              <p className="text-xs text-gray-400 mt-0.5">⏰ {job.scheduled_time}</p>
            )}
          </div>
          <button onClick={() => setExpanded(!expanded)} className="text-gray-500 p-1">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Quick actions */}
        <div className="flex gap-2 mt-3">
          <button onClick={openMaps} className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 bg-blue-950/50 px-3 py-1.5 rounded-lg">
            <MapPin className="w-3.5 h-3.5" /> Navigate
          </button>
          {job.status === 'assigned' && (
            <button
              onClick={() => {
                const startTs = new Date().toISOString();
                localStorage.setItem(`job_start_${job.id}`, startTs);
                onStatusUpdate(job, 'in_progress', { job_started_at: startTs });
              }}
              className="flex items-center gap-1.5 text-xs text-yellow-400 bg-yellow-950/50 px-3 py-1.5 rounded-lg hover:bg-yellow-900/50"
            >
              <Play className="w-3.5 h-3.5" /> Start Job
            </button>
          )}
          {job.status === 'in_progress' && (
            <button
              onClick={() => {
                const start = localStorage.getItem(`job_start_${job.id}`);
                const trail = getBreadcrumbs(job.id);
                const distKm = estimateDistanceKm(trail);
                const mins = start ? (Date.now() - new Date(start).getTime()) / 60000 : 0;

                // On-device ML: record for zone learning
                if (job.zone_id && mins > 0) {
                  recordJobCompletion(job.zone_id, job.id, mins, trail, routeFeedback || 'neutral');
                }

                // Upload GPS trail + duration to server
                onStatusUpdate(job, 'completed', {
                  completed_at: new Date().toISOString(),
                  actual_duration_mins: Math.round(mins),
                  actual_route_gps_path: JSON.stringify(trail),
                  route_distance_km: distKm,
                  driver_route_feedback: routeFeedback || 'neutral',
                  ...(start ? { job_started_at: start } : {}),
                });

                clearBreadcrumbs(job.id);
                localStorage.removeItem(`job_start_${job.id}`);
              }}
              className="flex items-center gap-1.5 text-xs text-green-400 bg-green-950/50 px-3 py-1.5 rounded-lg hover:bg-green-900/50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Complete
            </button>
          )}
          <button
            onClick={() => setShowLocationCorrection(true)}
            className="flex items-center gap-1.5 text-xs text-orange-400 bg-orange-950/40 px-3 py-1.5 rounded-lg hover:bg-orange-900/50"
            title="Suggest pin correction"
          >
            <MapPinOff className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Navigation Assist (shown when in progress) */}
      {job.status === 'in_progress' && (
        <div className="px-4 pb-3">
          <NavigationAssist
            job={job}
            startedAt={startedAt}
            gpsBreadcrumbs={breadcrumbs}
            onRouteFeedback={(fb) => setRouteFeedback(fb)}
          />
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-700 p-4 space-y-4">
          {job.notes && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Notes</p>
              <p className="text-sm text-gray-300">{job.notes}</p>
            </div>
          )}

          {job.estimated_weight_kg && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Estimated Weight</p>
              <p className="text-sm text-gray-300">{job.estimated_weight_kg} kg</p>
            </div>
          )}

          {/* Photos */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Proof of Service Photos ({job.photo_urls?.length || 0})</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {(job.photo_urls || []).map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  <img src={url} alt={`proof-${i}`} className="w-16 h-16 object-cover rounded-lg border border-gray-600" />
                </a>
              ))}
            </div>

            {/* CV Analysis Results */}
            {job.evidence_quality_score != null && (
              <div className={`rounded-lg px-3 py-2 mb-2 text-xs ${job.cv_flagged_for_review ? 'bg-red-950/50 border border-red-700' : 'bg-green-950/40 border border-green-700'}`}>
                <div className="flex items-center gap-2 mb-1">
                  {job.cv_flagged_for_review
                    ? <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                    : <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                  }
                  <span className={`font-semibold ${job.cv_flagged_for_review ? 'text-red-300' : 'text-green-300'}`}>
                    {job.cv_flagged_for_review ? 'Photo Flagged for Review' : 'Photo Verified'}
                  </span>
                  <span className="ml-auto flex items-center gap-1 text-gray-400">
                    <Star className="w-3 h-3" />{job.evidence_quality_score}/100
                  </span>
                </div>
                {job.cv_analysis_notes && <p className="text-gray-400">{job.cv_analysis_notes}</p>}
              </div>
            )}

            <input ref={fileRef} type="file" multiple accept="image/*" capture="environment" className="hidden" onChange={handleFiles} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 text-xs text-primary bg-primary/10 border border-primary/30 px-3 py-2 rounded-lg hover:bg-primary/20 disabled:opacity-50"
            >
              <Camera className="w-3.5 h-3.5" />
              {uploading ? 'Analysing photo with AI...' : 'Add Photos'}
            </button>
          </div>

          {/* Driver notes */}
          {job.driver_notes && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Driver Notes</p>
              <p className="text-sm text-gray-300">{job.driver_notes}</p>
            </div>
          )}
        </div>
      )}
      {showLocationCorrection && (
        <LocationCorrectionModal job={job} onClose={() => setShowLocationCorrection(false)} />
      )}
    </div>
  );
}