import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Truck, LogOut, RefreshCw, Wifi, WifiOff, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DriverJobCard from '@/components/driver/DriverJobCard';
import DriverStats from '@/components/driver/DriverStats';
import GPSTracker from '@/components/driver/GPSTracker';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/ui/PullToRefreshIndicator';
import PinSwitchScreen from '@/components/field/PinSwitchScreen';
import UserSessionBar from '@/components/field/UserSessionBar';

const SESSIONS_KEY = 'field_app_sessions';
const ACTIVE_SESSION_KEY = 'field_app_active_session';

function getSessions() {
  try { return JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]'); } catch { return []; }
}
function saveSessions(sessions) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}
function getActiveSession() {
  try { return JSON.parse(localStorage.getItem(ACTIVE_SESSION_KEY) || 'null'); } catch { return null; }
}
function saveActiveSession(session) {
  localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
}

export default function FieldApp() {
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [activeUser, setActiveUser] = useState(() => getActiveSession());
  const [sessions, setSessions] = useState(() => getSessions());
  const [showPinSwitch, setShowPinSwitch] = useState(false);
  const [pendingSync, setPendingSync] = useState(() => {
    try { return JSON.parse(localStorage.getItem('nlswms_pending_sync') || '[]'); } catch { return []; }
  });

  // Register current base44 user into sessions on first load
  useEffect(() => {
    base44.auth.me().then(user => {
      if (!user) return;
      const existing = getSessions();
      const alreadyExists = existing.find(s => s.id === user.id);
      if (!alreadyExists) {
        const updated = [...existing, { id: user.id, full_name: user.full_name, email: user.email, role: user.role, field_app_role: user.field_app_role || 'driver' }];
        saveSessions(updated);
        setSessions(updated);
      }
      if (!getActiveSession()) {
        saveActiveSession(user);
        setActiveUser(user);
      }
    });
  }, []);

  useEffect(() => {
    const onOnline = () => { setIsOnline(true); syncPendingUpdates(); };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, [pendingSync]);

  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: jobs = [], isLoading, refetch } = useQuery({
    queryKey: ['field-jobs', activeUser?.id],
    queryFn: async () => {
      const all = await base44.entities.PickupRequest.filter({ assigned_driver_id: activeUser?.id });
      localStorage.setItem(`nlswms_jobs_${activeUser?.id}`, JSON.stringify(all));
      return all;
    },
    placeholderData: () => {
      try { return JSON.parse(localStorage.getItem(`nlswms_jobs_${activeUser?.id}`) || '[]'); } catch { return []; }
    },
    enabled: !!activeUser?.id,
    retry: isOnline ? 3 : false,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PickupRequest.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['field-jobs'] }),
  });

  const syncPendingUpdates = async () => {
    const pending = JSON.parse(localStorage.getItem('nlswms_pending_sync') || '[]');
    if (!pending.length) return;
    for (const update of pending) {
      await base44.entities.PickupRequest.update(update.id, update.data);
    }
    localStorage.removeItem('nlswms_pending_sync');
    setPendingSync([]);
    queryClient.invalidateQueries({ queryKey: ['field-jobs'] });
  };

  const handleStatusUpdate = (job, newStatus) => {
    const updateData = { status: newStatus, ...(newStatus === 'completed' ? { completed_at: new Date().toISOString() } : {}) };
    if (isOnline) {
      updateMutation.mutate({ id: job.id, data: updateData });
    } else {
      const pending = JSON.parse(localStorage.getItem('nlswms_pending_sync') || '[]');
      pending.push({ id: job.id, data: updateData });
      localStorage.setItem('nlswms_pending_sync', JSON.stringify(pending));
      setPendingSync(pending);
      const cached = JSON.parse(localStorage.getItem(`nlswms_jobs_${activeUser?.id}`) || '[]');
      const updated = cached.map(j => j.id === job.id ? { ...j, ...updateData } : j);
      localStorage.setItem(`nlswms_jobs_${activeUser?.id}`, JSON.stringify(updated));
      queryClient.setQueryData(['field-jobs', activeUser?.id], updated);
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
    let cvData = {};
    if (uploadedUrls.length > 0) {
      const cvRes = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyse this proof-of-service photo. Assess: 1) Is a waste bin visible? 2) Is the bin properly positioned? 3) Is the image sharp/well-lit? 4) Does it prove service completion? Assign quality_score 0-100.`,
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
    await base44.entities.PickupRequest.update(job.id, { photo_urls: allPhotos, ...cvData });
    queryClient.invalidateQueries({ queryKey: ['field-jobs'] });
  };

  const handleSwitchUser = (user) => {
    saveActiveSession(user);
    setActiveUser(user);
    setShowPinSwitch(false);
    queryClient.invalidateQueries({ queryKey: ['field-jobs'] });
  };

  const handleAddSession = async () => {
    base44.auth.redirectToLogin(window.location.href);
  };

  const { pulling, pullDistance, refreshing } = usePullToRefresh({ onRefresh: refetch });

  const todayJobs = jobs.filter(j => j.scheduled_date === today || j.status === 'in_progress');
  const completedToday = todayJobs.filter(j => j.status === 'completed').length;

  if (!activeUser) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="text-center text-white">
          <Truck className="w-12 h-12 mx-auto mb-4 text-primary" />
          <p className="text-lg font-semibold mb-4">Field App</p>
          <Button onClick={handleAddSession}>Sign In</Button>
        </div>
      </div>
    );
  }

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
              <p className="font-semibold font-jakarta text-sm">{activeUser?.full_name?.split(' ')[0] || 'Field Staff'}</p>
              <p className="text-xs text-gray-400">{format(new Date(), 'EEE, MMM d')} · {activeUser?.field_app_role || 'driver'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <GPSTracker
              user={activeUser}
              currentJobId={todayJobs.find(j => j.status === 'in_progress')?.id}
              currentRouteId={null}
              isOnline={isOnline}
            />
            {isOnline
              ? <span className="flex items-center gap-1 text-xs text-green-400"><Wifi className="w-3 h-3" /> Online</span>
              : <span className="flex items-center gap-1 text-xs text-yellow-400"><WifiOff className="w-3 h-3" /> Offline</span>
            }
            <button onClick={() => setShowPinSwitch(true)} className="p-2 text-gray-400 hover:text-white" title="Switch User">
              <Users className="w-4 h-4" />
            </button>
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

      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />

      {/* Session switcher bar */}
      {sessions.length > 1 && (
        <UserSessionBar sessions={sessions} activeUser={activeUser} onSwitch={() => setShowPinSwitch(true)} />
      )}

      <DriverStats jobs={todayJobs} completedToday={completedToday} />

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

      {/* PIN Switch Modal */}
      {showPinSwitch && (
        <PinSwitchScreen
          sessions={sessions}
          activeUser={activeUser}
          onSwitch={handleSwitchUser}
          onAddUser={handleAddSession}
          onClose={() => setShowPinSwitch(false)}
        />
      )}
    </div>
  );
}