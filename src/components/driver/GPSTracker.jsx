import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Navigation, NavigationOff } from 'lucide-react';
import { appendBreadcrumb } from '@/components/driver/GPSBreadcrumbTracker';

const INTERVAL_MS = 15000; // Send location every 15 seconds

export default function GPSTracker({ user, currentJobId, currentRouteId, isOnline }) {
  const [tracking, setTracking] = useState(false);
  const [error, setError] = useState(null);
  const [lastSent, setLastSent] = useState(null);
  const watchIdRef = useRef(null);
  const intervalRef = useRef(null);
  const lastCoordsRef = useRef(null);

  const sendLocation = async (coords) => {
    if (!coords) return;
    // Always record breadcrumb locally regardless of online status
    if (currentJobId && coords.latitude && coords.longitude) {
      appendBreadcrumb(currentJobId, coords.latitude, coords.longitude, {
        speed_kmh: coords.speed != null ? Math.round(coords.speed * 3.6) : null,
        heading: coords.heading,
        accuracy: coords.accuracy,
      });
    }
    if (!isOnline) return;
    try {
      await base44.functions.invoke('updateDriverLocation', {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy_meters: coords.accuracy,
        heading: coords.heading,
        speed_kmh: coords.speed != null ? coords.speed * 3.6 : null, // m/s → km/h
        route_id: currentRouteId || null,
        current_job_id: currentJobId || null,
        tenant_id: user?.tenant_id || '',
      });
      setLastSent(new Date());
    } catch (_) {}
  };

  const startTracking = () => {
    if (!navigator.geolocation) {
      setError('GPS not supported on this device');
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        lastCoordsRef.current = pos.coords;
        setError(null);
      },
      (err) => {
        if (err.code === 1) setError('Location permission denied. Enable GPS in browser settings.');
        else setError('GPS signal weak or unavailable.');
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );

    intervalRef.current = setInterval(() => {
      sendLocation(lastCoordsRef.current);
    }, INTERVAL_MS);

    setTracking(true);
  };

  const stopTracking = () => {
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    watchIdRef.current = null;
    intervalRef.current = null;
    setTracking(false);
  };

  // Auto-start when user is online
  useEffect(() => {
    if (isOnline) startTracking();
    return () => stopTracking();
  }, [isOnline]);

  // Re-send when job/route changes
  useEffect(() => {
    sendLocation(lastCoordsRef.current);
  }, [currentJobId, currentRouteId]);

  return (
    <button
      onClick={() => tracking ? stopTracking() : startTracking()}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
        tracking
          ? 'bg-green-900/50 text-green-400 border border-green-700'
          : 'bg-gray-800 text-gray-400 border border-gray-700'
      }`}
      title={error || (tracking ? 'GPS tracking active — tap to stop' : 'Tap to enable GPS tracking')}
    >
      {tracking ? <Navigation className="w-3 h-3" /> : <NavigationOff className="w-3 h-3" />}
      {tracking ? (lastSent ? 'GPS Live' : 'GPS Starting...') : 'GPS Off'}
      {error && <span className="text-yellow-400 ml-1">!</span>}
    </button>
  );
}