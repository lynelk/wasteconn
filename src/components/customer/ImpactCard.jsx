import { Card, CardContent } from '@/components/ui/card';
import { Leaf, Recycle, Cloud, Award } from 'lucide-react';
import { computeImpact } from '@/lib/impact';

const TIER_STYLE = {
  bronze: 'text-amber-700',
  silver: 'text-slate-500',
  gold: 'text-yellow-500',
  platinum: 'text-cyan-600',
};

export default function ImpactCard({ pickups = [], loyalty, t = (k) => k }) {
  const impact = computeImpact(pickups);

  return (
    <Card className="mb-4 border-border/60 bg-gradient-to-br from-green-50 to-transparent dark:from-green-950/20">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-2 mb-3">
          <Leaf className="w-4 h-4 text-green-600" />
          <span className="text-sm font-semibold font-jakarta">{t('impact.title')}</span>
          {loyalty?.tier && (
            <span className={`ml-auto flex items-center gap-1 text-xs font-semibold capitalize ${TIER_STYLE[loyalty.tier] || 'text-muted-foreground'}`}>
              <Award className="w-3.5 h-3.5" /> {loyalty.tier}
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <Recycle className="w-4 h-4 mx-auto mb-1 text-green-600" />
            <div className="text-lg font-bold font-jakarta">{impact.completedPickups}</div>
            <div className="text-[10px] text-muted-foreground">{t('impact.pickups')}</div>
          </div>
          <div>
            <div className="text-lg font-bold font-jakarta text-green-700">{impact.kgDiverted}</div>
            <div className="text-[10px] text-muted-foreground">{t('impact.kgDiverted')}</div>
          </div>
          <div>
            <Cloud className="w-4 h-4 mx-auto mb-1 text-sky-600" />
            <div className="text-lg font-bold font-jakarta text-sky-700">{impact.co2SavedKg}</div>
            <div className="text-[10px] text-muted-foreground">{t('impact.co2Saved')}</div>
          </div>
        </div>
        {loyalty?.points != null && (
          <p className="text-xs text-center text-muted-foreground mt-3">
            <span className="font-semibold text-foreground">{loyalty.points.toLocaleString()}</span> {t('loyalty.points')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
