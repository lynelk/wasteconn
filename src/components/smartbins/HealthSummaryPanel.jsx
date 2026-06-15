import { AlertTriangle, CheckCircle2, Wrench, WifiOff } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { classifyFill, predictDaysToFull } from '@/lib/capacityAnalytics';

function HealthRow({ icon: Icon, label, items, iconClass }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${iconClass}`} />
        <span className="text-sm font-semibold font-jakarta">{label}</span>
        <Badge variant="secondary" className="text-xs">{items.length}</Badge>
      </div>
      <div className="space-y-1">
        {items.slice(0, 5).map((c) => (
          <div key={c.id} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-muted/50">
            <span className="font-medium truncate max-w-[60%]">{c.label || c.qr_code || c.id}</span>
            <span className="text-muted-foreground">
              {c.asset_category === 'skip' && typeof c.last_weight_kg === 'number'
                ? `${c.last_weight_kg} kg`
                : typeof c.last_fill_pct === 'number'
                  ? `${Math.round(c.last_fill_pct)}%`
                  : '—'}
            </span>
          </div>
        ))}
        {items.length > 5 && (
          <p className="text-xs text-muted-foreground px-2">+{items.length - 5} more</p>
        )}
      </div>
    </div>
  );
}

export default function HealthSummaryPanel({ containers = [] }) {
  const urgent = containers.filter((c) => {
    const fill = c.last_fill_pct;
    return typeof fill === 'number' && fill >= (c.collection_threshold_pct ?? 80);
  });

  const dueWithin24h = containers.filter((c) => {
    if (urgent.find((u) => u.id === c.id)) return false;
    const days = predictDaysToFull(c.last_fill_pct, c.avg_daily_fill_rate_pct);
    return days !== null && days <= 1;
  });

  const maintenance = containers.filter((c) => c.status === 'maintenance');

  const noSignal = containers.filter((c) => {
    if (!c.last_reading_at) return true;
    const hrs = (Date.now() - new Date(c.last_reading_at).getTime()) / 3600000;
    return hrs > 24;
  });

  const healthy = containers.length - urgent.length - dueWithin24h.length - maintenance.length - noSignal.length;

  if (!containers.length) return null;

  return (
    <Card className="border-border/60">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold font-jakarta text-sm">Asset Health Summary</h2>
          <div className="flex items-center gap-1.5 text-xs text-green-700">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{healthy} healthy</span>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-5">
          <HealthRow
            icon={AlertTriangle}
            label="Urgent — needs collection"
            items={urgent}
            iconClass="text-red-500"
          />
          <HealthRow
            icon={AlertTriangle}
            label="Due within 24 h"
            items={dueWithin24h}
            iconClass="text-orange-500"
          />
          <HealthRow
            icon={Wrench}
            label="In maintenance"
            items={maintenance}
            iconClass="text-yellow-600"
          />
          <HealthRow
            icon={WifiOff}
            label="No signal (>24 h)"
            items={noSignal}
            iconClass="text-muted-foreground"
          />
        </div>
        {!urgent.length && !dueWithin24h.length && !maintenance.length && !noSignal.length && (
          <div className="flex items-center gap-2 text-sm text-green-700">
            <CheckCircle2 className="w-4 h-4" />
            All assets are healthy — no action required.
          </div>
        )}
      </CardContent>
    </Card>
  );
}