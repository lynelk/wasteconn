import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Truck, MapPin, CheckCircle2, Clock, Camera, LogOut, RefreshCw, ChevronDown, ChevronUp, Upload, Wifi, WifiOff } from 'lucide-react';
import { base44 as sdk } from '@/api/base44Client';
import DriverJobCard from '@/components/driver/DriverJobCard';
import DriverStats from '@/components/driver/DriverStats';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/ui/PullToRefreshIndicator';

const statusOrder = ['assigned', 'in_progress', 'completed', 'cancelled'];

export default function DriverApp() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSync, setPendingSync] = useState(() => {
    try { return JSON.parse(localStorage.getItem('nlswms_pending_sync') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      syncPendingUpdates();
    };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, [pendingSync]);

  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: jobs = [], isLoading, refetch } = useQuery({
    queryKey: ['driver-jobs', user?.id],
    queryFn: async () => {
      const all = await base44.entities.PickupRequest.filter({ assigned_driver_id: user?.id });
      // Cache for offline
      localStorage.setItem('nlswms_driver_jobs', JSON.stringify(all));
      return all;
    },
    // Fallback to cache if offline
    placeholderData: () => {
      try { return JSON.parse(localStorage.getItem('nlswms_driver_jobs') || '[]'); } catch { return []; }
    },
    retry: isOnline ? 3 : false,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PickupRequest.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['driver-jobs'] }),
  });

  const syncPendingUpdates = async () => {
    const pending = JSON.parse(localStorage.getItem('nlswms_pending_sync') || '[]');
    if (!pending.length) return;
    for (const update of pending) {
      await base44.entities.PickupRequest.update(update.id, update.data);
    }
    localStorage.removeItem('nlswms_pending_sync');
    setPendingSync([]);
    queryClient.invalidateQueries({ queryKey: ['driver-jobs'] });
  };

  const handleStatusUpdate = (job, newStatus) => {
    const updateData = { status: newStatus, ...(newStatus === 'completed' ? { completed_at: new Date().toISOString() } : {}) };
    if (isOnline) {
      updateMutation.mutate({ id: job.id, data: updateData });
    } else {
      // Queue for offline sync
      const pending = JSON.parse(localStorage.getItem('nlswms_pending_sync') || '[]');
      pending.push({ id: job.id, data: updateData });
      localStorage.setItem('nlswms_pending_sync', JSON.stringify(pending));
      setPendingSync(pending);
      // Optimistic update in cache
      const cached = JSON.parse(localStorage.getItem('nlswms_driver_jobs') || '[]');
      const updated = cached.map(j => j.id === job.id ? { ...j, ...updateData } : j);
      localStorage.setItem('nlswms_driver_jobs', JSON.stringify(updated));
      queryClient.setQueryData(['driver-jobs', user?.id], updated);
    }
  };

  const handlePhotoUpload = async (job, files) => {
    const uploadedUrls = [];
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      uploadedUrls.push(file_url);
    }
    const existingPhotos = job.photo_urls || [];
    const allPhotos = [...existingPhotos, ...uploadedUrls];

    // Run CV analysis on the first new photo
    let cvData = {};
    if (uploadedUrls.length > 0) {
      const cvRes = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a waste management evidence quality inspector.
Analyse this proof-of-service photo submitted by a driver upon job completion.

Assess the following:
1. Is a waste bin clearly visible in the image?
2. Is the bin properly positioned (upright, accessible, not tipped over)?
3. Is the image sharp and well-lit (not blurry or too dark)?
4. Does the photo provide adequate proof of service completion?

Assign an overall quality_score from 0-100:
- 90-100: Excellent, bin clearly visible, well positioned, sharp photo
- 70-89: Good, minor issues but acceptable
- 50-69: Acceptable but has issues (slightly blurry, bin partially visible)
- Below 50: Poor quality, flag for manual review

Be concise in your analysis_notes.`,
        file_urls: [uploadedUrls[0]],
        response_json_schema: {
          type: 'object',
          properties: {
            bin_present: { type: 'boolean' },
            bin_positioned_correctly: { type: 'boolean' },
            quality_score: { type: 'number' },
            flag_for_review: { type: 'boolean' },
            analysis_notes: { type: 'string' },
          }
        }
      });

      cvData = {
        evidence_quality_score: cvRes.quality_score ?? null,
        cv_bin_present: cvRes.bin_present ?? null,
        cv_bin_positioned_correctly: cvRes.bin_positioned_correctly ?? null,
        cv_flagged_for_review: cvRes.flag_for_review ?? false,
        cv_analysis_notes: cvRes.analysis_notes || '',
      };
    }

    await base44.entities.PickupRequest.update(job.id, {
      photo_urls: allPhotos,
      ...cvData,
    });
    queryClient.invalidateQueries({ queryKey: ['driver-jobs'] });
  };

  const { pulling, pullDistance, refreshing } = usePullToRefresh({ onRefresh: refetch });

  const todayJobs = jobs.filter(j => j.scheduled_date === today || j.status === 'in_progress');
  const completedToday = todayJobs.filter(j => j.status === 'completed').length;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col max-w-md mx-auto">
      {/* Header */}
      <div className="bg-gray-900 px-4 pt-safe-top pb-4 sticky top-0 z-20 border-b border-gray-800">
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold font-jakarta text-sm">{user?.full_name?.split(' ')[0] || 'Driver'}</p>
              <p className="text-xs text-gray-400">{format(new Date(), 'EEE, MMM d')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isOnline ? (
              <span className="flex items-center gap-1 text-xs text-green-400"><Wifi className="w-3 h-3" /> Online</span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-yellow-400"><WifiOff className="w-3 h-3" /> Offline</span>
            )}
            <button onClick={() => refetch()} className="p-2 text-gray-400 hover:text-white">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => base44.auth.logout('/')} className="p-2 text-gray-400 hover:text-white">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {pendingSync.length > 0 && (
          <div className="mt-2 bg-yellow-900/50 border border-yellow-700 rounded-lg px-3 py-2 flex items-center justify-between">
            <p className="text-xs text-yellow-300">{pendingSync.length} update(s) pending sync</p>
            {isOnline && <button onClick={syncPendingUpdates} className="text-xs text-yellow-400 underline">Sync now</button>}
          </div>
        )}
      </div>

      {/* Pull-to-refresh indicator */}
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />

      {/* Stats */}
      <DriverStats jobs={todayJobs} completedToday={completedToday} />

      {/* Jobs */}
      <div className="flex-1 overflow-auto px-4 pb-8">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Today's Jobs ({todayJobs.length})
        </h2>

        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-28 bg-gray-800 rounded-xl animate-pulse" />)}
          </div>
        ) : todayJobs.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No jobs assigned for today</p>
          </div>
        ) : (
          <div className="space-y-3">
            {todayJobs.map(job => (
              <DriverJobCard
                key={job.id}
                job={job}
                onStatusUpdate={handleStatusUpdate}
                onPhotoUpload={handlePhotoUpload}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}