import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const THRESHOLD = 80;
const POLL_INTERVAL_MS = 30_000; // auto-refresh every 30s

export default function FillAlertBanner({ containers = [], onRefresh }) {
  const [dismissed, setDismissed] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Auto-refresh
  useEffect(() => {
    const timer = setInterval(() => {
      if (onRefresh) onRefresh();
      setLastUpdated(new Date());
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [onRefresh]);

  const alertBins = containers.filter(c =>
    typeof c.last_fill_pct === 'number' && c.last_fill_pct >= THRESHOLD && c.status !== 'maintenance'
  );

  const critical = alertBins.filter(c => c.last_fill_pct >= 95);
  const high = alertBins.filter(c => c.last_fill_pct >= THRESHOLD && c.last_fill_pct < 95);

  if (alertBins.length === 0 || dismissed) return null;

  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-orange-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">
                {alertBins.length} container{alertBins.length !== 1 ? 's' : ''} require urgent collection
              </p>
              {critical.length > 0 && (
                <Badge className="bg-red-100 text-red-700 text-[10px]">{critical.length} overflowing</Badge>
              )}
              {high.length > 0 && (
                <Badge className="bg-orange-100 text-orange-700 text-[10px]">{high.length} above {THRESHOLD}%</Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {alertBins.slice(0, 8).map(c => (
                <div
                  key={c.id}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${
                    c.last_fill_pct >= 95
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                      : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${c.last_fill_pct >= 95 ? 'bg-red-500 animate-pulse' : 'bg-orange-500'}`} />
                  {c.label || c.qr_code || c.id?.slice(0, 6)}
                  <span className="font-bold">{Math.round(c.last_fill_pct)}%</span>
                </div>
              ))}
              {alertBins.length > 8 && (
                <span className="text-xs text-orange-700 dark:text-orange-400 px-2 py-1">+{alertBins.length - 8} more</span>
              )}
            </div>
            <p className="text-[11px] text-orange-600 dark:text-orange-400 mt-2">
              Auto-refreshes every 30s · Last updated {lastUpdated.toLocaleTimeString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-orange-600 hover:bg-orange-100"
            onClick={() => { if (onRefresh) onRefresh(); setLastUpdated(new Date()); }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-orange-600 hover:bg-orange-100"
            onClick={() => setDismissed(true)}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}