import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Truck, LogOut, RefreshCw, AlertTriangle, Users, Package } from 'lucide-react';
import DistributionModal from '@/components/distributions/DistributionModal';
import { Button } from '@/components/ui/button';
import DriverJobCard from '@/components/driver/DriverJobCard';
import DriverStats from '@/components/driver/DriverStats';
import GPSTracker from '@/components/driver/GPSTracker';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/ui/PullToRefreshIndicator';
import PinSwitchScreen from '@/components/field/PinSwitchScreen';
import UserSessionBar from '@/components/field/UserSessionBar';
import IncidentReportModal from '@/components/field/IncidentReportModal';
import { useSyncManager } from '@/lib/useSyncManager';
import {
  cacheDriverJobs,
  updateCachedDriverJob,
  enqueueAction,
} from '@/lib/offlineDB';

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
  const { isOnline, pendingCount, syncing, syncNow } = useSyncManager();

  const [activeUser, setActiveUser] = useState(() => getActiveSession());
  const [sessions, setSessions] = useState(() => getSessions());
  const [showPinSwitch, setShowPinSwitch] = useState(false);
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [selectedJobForIncident, setSelectedJobForIncident] = useState(null);
  const [distributionOpen, setDistributionOpen] = useState(false);
  const [selectedJobForDistribution, setSelectedJobForDistribution] = useState(null);

  // Register current base44 user into sessions on first load
  useEffect(() => {
    base44.auth.me().then(user => {
      if (!user) return;
      const existing = getSessions();
      const alreadyExists = existing.find(s => s.id === user.id);
      if (!alreadyExists) {
        const updated = [...existing, {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          field_app_role: user.field_app_role || 'driver',
        }];
        saveSessions(updated);
        setSessions(updated);
      }
      if (!getActiveSession()) {
        saveActiveSession(user);
        setActiveUser(user);
      }
    });
  }, []);

  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: jobs = [], isLoading, refetch } = useQuery({
    queryKey: ['field-jobs', activeUser?.id],
    queryFn: async () => {
      const all = await base44.entities.PickupRequest.filter({ assigned_driver_id: activeUser?.id });
      await cacheDriverJobs(all);
      return all;
    },
    placeholderData: [],
    enabled: !!activeUser?.id,
    retry: isOnline ? 3 : false,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PickupRequest.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['field-jobs'] }),
  });

  const handleStatusUpdate = async (job, newStatus, extraData = {}) => {
    const updateData = {
      status: newStatus,
      ...(newStatus === 'completed' ? { completed_at: new Date().toISOString() } : {}),
      ...extraData,
    };
    if (isOnline) {
      updateMutation.mutate({ id: job.id, data: updateData });
    } else {
      // Queue in IndexedDB and optimistically update cached jobs
      await enqueueAction('PickupRequest', 'update', { id: job.id, data: updateData });
      await updateCachedDriverJob(job.id, updateData);
      queryClient.setQueryData(['field-jobs', activeUser?.id], (old = []) =>
        old.map(j => j.id === job.id ? { ...j, ...updateData } : j)
      );
    }
  };

  const handlePhotoUpload = async (job, files) => {
    const uploadedUrls = [];
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      uploadedUrls.push(file_url);
    }
    const allPhotos = [...(job.photo_urls || []), ...uploadedUrls];
    let cvData = {};
    if (uploadedUrls.length > 0) {
      const cvRes = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a waste management evidence quality inspector.
Analyse this proof-of-service photo submitted by a driver upon job completion.
Assess: 1) Is a waste bin clearly visible? 2) Is the bin properly positioned? 3) Is the image sharp and well-lit? 4) Does it prove service completion?
Assign quality_score 0-100 (90-100: Excellent, 70-89: Good, 50-69: Acceptable, <50: Poor).`,
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

  const handleReportIncident = (job) => {
    setSelectedJobForIncident(job);
    setIncidentOpen(true);
  };

  const handleGiveOutItems = (job) => {
    setSelectedJobForDistribution(job);
    setDistributionOpen(true);
  };

  const handleSwitchUser = (user) => {
    saveActiveSession(user);
    setActiveUser(user);
    setShowPinSwitch(false);
    queryClient.invalidateQueries({ queryKey: ['field-jobs'] });
  };

  const handleAddSession = () => {
    base44.auth.redirectToLogin(window.location.href);
  };

  const { pullDistance, refreshing } = usePullToRefresh({ onRefresh: refetch });

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
            <button
              onClick={() => setIncidentOpen(true)}
              className="flex items-center gap-1 text-xs text-red-400 bg-red-900/30 px-2 py-1 rounded-lg border border-red-800"
            >
              <AlertTriangle className="w-3 h-3" /> Incident
            </button>
            {isOnline
              ? <span className="text-xs text-green-400">● Online</span>
              : <span className="text-xs text-yellow-400">● Offline</span>
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

        {/* Pending sync banner */}
        {pendingCount > 0 && (
          <div className="mt-2 bg-yellow-900/50 border border-yellow-700 rounded-lg px-3 py-2 flex items-center justify-between">
            <p className="text-xs text-yellow-300">
              {syncing ? 'Syncing…' : `${pendingCount} update(s) pending sync`}
            </p>
            {isOnline && !syncing && (
              <button onClick={syncNow} className="text-xs text-yellow-400 underline">Sync now</button>
            )}
          </div>
        )}
      </div>

      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />

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
            {[1, 2, 3].map(i => <div key={i} className="h-28 bg-gray-800 rounded-xl animate-pulse" />)}
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
                onReportIncident={handleReportIncident}
                onGiveOutItems={handleGiveOutItems}
              />
            ))}
          </div>
        )}
      </div>

      {showPinSwitch && (
        <PinSwitchScreen
          sessions={sessions}
          activeUser={activeUser}
          onSwitch={handleSwitchUser}
          onAddUser={handleAddSession}
          onClose={() => setShowPinSwitch(false)}
        />
      )}

      <IncidentReportModal
        open={incidentOpen}
        onClose={() => { setIncidentOpen(false); setSelectedJobForIncident(null); }}
        pickupId={selectedJobForIncident?.id}
        user={activeUser}
        isOnline={isOnline}
      />

      {distributionOpen && selectedJobForDistribution && (
        <DistributionModal
          job={selectedJobForDistribution}
          activeUser={activeUser}
          onClose={() => { setDistributionOpen(false); setSelectedJobForDistribution(null); }}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['field-jobs'] })}
        />
      )}
    </div>
  );
}