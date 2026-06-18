import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Clock, LogIn, LogOut, Gauge, MapPin } from 'lucide-react';
import { format } from 'date-fns';

export default function ShiftClockWidget({ user }) {
  const queryClient = useQueryClient();
  const [odometer, setOdometer] = useState('');
  const [gpsCoords, setGpsCoords] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ['shift-settings'],
    queryFn: () => base44.entities.ShiftSettings.list(),
    select: data => data[0] || {},
  });

  const { data: activeShift } = useQuery({
    queryKey: ['active-shift', user?.id],
    queryFn: async () => {
      const shifts = await base44.entities.DriverShift.filter({ driver_id: user?.id, status: 'active' });
      return shifts[0] || null;
    },
    enabled: !!user?.id,
  });

  const clockInMutation = useMutation({
    mutationFn: (data) => base44.entities.DriverShift.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-shift'] });
      setOdometer('');
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DriverShift.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['active-shift'] }),
  });

  const captureGPS = () => {
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => { setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGpsLoading(false); },
      () => setGpsLoading(false),
    );
  };

  const handleClockIn = () => {
    if (settings?.require_odometer && !odometer) return;
    clockInMutation.mutate({
      tenant_id: user?.tenant_id || '',
      driver_id: user?.id,
      clock_in: new Date().toISOString(),
      start_odometer: odometer ? parseFloat(odometer) : undefined,
      start_lat: gpsCoords?.lat,
      start_lng: gpsCoords?.lng,
      status: 'active',
    });
  };

  const handleClockOut = () => {
    if (!activeShift) return;
    clockOutMutation.mutate({
      id: activeShift.id,
      data: {
        clock_out: new Date().toISOString(),
        end_odometer: odometer ? parseFloat(odometer) : undefined,
        status: 'completed',
      },
    });
    setOdometer('');
  };

  // Elapsed time display
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    if (!activeShift) { setElapsed(''); return; }
    const tick = () => {
      const diff = Date.now() - new Date(activeShift.clock_in).getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setElapsed(`${h}h ${m}m`);
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [activeShift]);

  const requireOdo = settings?.require_odometer;
  const requireLoc = settings?.require_location;

  return (
    <div className={`mx-4 my-3 rounded-xl border p-4 ${activeShift ? 'bg-green-950/50 border-green-700' : 'bg-gray-800/60 border-gray-700'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className={`w-4 h-4 ${activeShift ? 'text-green-400' : 'text-gray-400'}`} />
          <span className="text-sm font-semibold">{activeShift ? 'Shift Active' : 'Not Clocked In'}</span>
        </div>
        {activeShift && <span className="text-xs text-green-300 font-mono">{elapsed}</span>}
      </div>

      {activeShift && (
        <p className="text-xs text-gray-400 mb-3">
          Started: {format(new Date(activeShift.clock_in), 'HH:mm, MMM d')}
          {activeShift.start_odometer ? ` · Odometer: ${activeShift.start_odometer.toLocaleString()} km` : ''}
        </p>
      )}

      <div className="space-y-2">
        {(requireOdo || (!activeShift && true)) && (
          <div className="flex items-center gap-2">
            <Gauge className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <input
              type="number"
              placeholder={`Odometer (km)${requireOdo ? ' *' : ''}`}
              value={odometer}
              onChange={e => setOdometer(e.target.value)}
              className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500"
            />
          </div>
        )}

        {requireLoc && !activeShift && (
          <button
            onClick={captureGPS}
            disabled={gpsLoading || !!gpsCoords}
            className={`flex items-center gap-2 w-full px-3 py-1.5 rounded-lg border text-xs ${
              gpsCoords ? 'bg-green-900/40 border-green-600 text-green-300' : 'bg-gray-700 border-gray-600 text-gray-300'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            {gpsLoading ? 'Getting location...' : gpsCoords ? `Location captured (${gpsCoords.lat.toFixed(4)}, ${gpsCoords.lng.toFixed(4)})` : 'Capture GPS Location *'}
          </button>
        )}

        {!activeShift ? (
          <button
            onClick={handleClockIn}
            disabled={clockInMutation.isPending || (requireOdo && !odometer) || (requireLoc && !gpsCoords)}
            className="w-full flex items-center justify-center gap-2 bg-primary text-white rounded-xl py-2.5 font-semibold text-sm disabled:opacity-50"
          >
            <LogIn className="w-4 h-4" />
            {clockInMutation.isPending ? 'Clocking In...' : 'Clock In'}
          </button>
        ) : (
          <button
            onClick={handleClockOut}
            disabled={clockOutMutation.isPending}
            className="w-full flex items-center justify-center gap-2 bg-red-600 text-white rounded-xl py-2.5 font-semibold text-sm disabled:opacity-50"
          >
            <LogOut className="w-4 h-4" />
            {clockOutMutation.isPending ? 'Clocking Out...' : 'Clock Out'}
          </button>
        )}
      </div>
    </div>
  );
}