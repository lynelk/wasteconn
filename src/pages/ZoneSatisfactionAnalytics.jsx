import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, Loader2, Zap, MapPin, ThumbsUp, ThumbsDown, AlertTriangle } from 'lucide-react';

function StarDisplay({ rating }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(s => (
        <Star key={s} className={`w-3.5 h-3.5 ${s <= Math.round(rating) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
      ))}
      <span className="text-xs text-muted-foreground ml-1">{Number(rating).toFixed(1)}</span>
    </div>
  );
}

export default function ZoneSatisfactionAnalytics() {
  const queryClient = useQueryClient();
  const [analysisResults, setAnalysisResults] = useState(null);

  const { data: surveys = [], isLoading } = useQuery({
    queryKey: ['satisfaction-surveys'],
    queryFn: () => base44.entities.CustomerSatisfaction.list('-created_date', 200),
  });

  const { data: zones = [] } = useQuery({
    queryKey: ['zones'],
    queryFn: () => base44.entities.ServiceZone.list(),
  });

  const analysisMutation = useMutation({
    mutationFn: () => base44.functions.invoke('analyzeZoneSatisfaction', {}),
    onSuccess: (res) => setAnalysisResults(res.data?.zones || []),
  });

  const responded = surveys.filter(s => s.rating != null);
  const avgOverall = responded.length > 0
    ? (responded.reduce((s, r) => s + r.rating, 0) / responded.length).toFixed(1)
    : null;

  const pending = surveys.filter(s => s.rating == null).length;

  // Group responded by zone for summary cards
  const byZone = {};
  for (const s of responded) {
    const zid = s.zone_id || 'unknown';
    if (!byZone[zid]) byZone[zid] = [];
    byZone[zid].push(s);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-jakarta">Customer Satisfaction</h1>
          <p className="text-sm text-muted-foreground">Post-pickup survey analytics by service zone</p>
        </div>
        <Button
          size="sm"
          onClick={() => analysisMutation.mutate()}
          disabled={analysisMutation.isPending || responded.length === 0}
        >
          {analysisMutation.isPending
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Analysing...</>
            : <><Zap className="w-4 h-4" /> AI Zone Analysis</>}
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border/60"><CardContent className="pt-5 pb-4">
          <p className="text-2xl font-bold font-jakarta">{surveys.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Total Surveys Sent</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="pt-5 pb-4">
          <p className="text-2xl font-bold font-jakarta text-primary">{responded.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Responses Received</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="pt-5 pb-4">
          <p className="text-2xl font-bold font-jakarta text-yellow-600">{pending}</p>
          <p className="text-xs text-muted-foreground mt-1">Awaiting Response</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="pt-5 pb-4">
          <p className="text-2xl font-bold font-jakarta">{avgOverall ?? '—'}</p>
          <p className="text-xs text-muted-foreground mt-1">Avg Rating (1-5)</p>
        </CardContent></Card>
      </div>

      {/* Zone breakdown from survey data */}
      {Object.keys(byZone).length > 0 && (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Object.entries(byZone).map(([zoneId, zoneSurveys]) => {
            const zoneName = zones.find(z => z.id === zoneId)?.zone_name || 'Unknown Zone';
            const avg = (zoneSurveys.reduce((s, r) => s + r.rating, 0) / zoneSurveys.length).toFixed(1);
            const positive = zoneSurveys.filter(s => s.rating >= 4).length;
            const negative = zoneSurveys.filter(s => s.rating <= 2).length;
            return (
              <Card key={zoneId} className="border-border/60">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-sm font-jakarta">{zoneName}</p>
                      <p className="text-xs text-muted-foreground">{zoneSurveys.length} responses</p>
                    </div>
                  </div>
                  <StarDisplay rating={avg} />
                  <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 text-green-600"><ThumbsUp className="w-3 h-3" />{positive}</span>
                    <span className="flex items-center gap-1 text-red-500"><ThumbsDown className="w-3 h-3" />{negative}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* AI Analysis Results */}
      {analysisResults && analysisResults.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">AI Zone Analysis</h2>
          {analysisResults.map((z, i) => (
            <Card key={i} className="border-primary/30 bg-primary/5">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-sm font-jakarta">{z.zone_name}</p>
                    <StarDisplay rating={z.avg_rating} />
                  </div>
                  <Badge className="text-xs bg-primary/10 text-primary border-primary/20">{z.response_count} responses</Badge>
                </div>
                {z.summary && <p className="text-xs text-muted-foreground mb-3">{z.summary}</p>}
                {z.pain_points?.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs font-semibold flex items-center gap-1 mb-1 text-red-600"><AlertTriangle className="w-3 h-3" />Pain Points</p>
                    <div className="flex flex-wrap gap-1">
                      {z.pain_points.map((p, j) => (
                        <Badge key={j} variant="secondary" className="text-xs bg-red-50 text-red-700">{p}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {z.positive_themes?.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs font-semibold flex items-center gap-1 mb-1 text-green-600"><ThumbsUp className="w-3 h-3" />Positive Themes</p>
                    <div className="flex flex-wrap gap-1">
                      {z.positive_themes.map((p, j) => (
                        <Badge key={j} variant="secondary" className="text-xs bg-green-50 text-green-700">{p}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {z.recommendation && (
                  <p className="text-xs text-primary bg-primary/10 rounded-lg px-3 py-2">
                    💡 {z.recommendation}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}</div>
      )}

      {!isLoading && surveys.length === 0 && (
        <Card className="border-dashed border-border/60">
          <CardContent className="py-16 text-center text-muted-foreground">
            <Star className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No surveys yet</p>
            <p className="text-xs mt-1">Surveys are sent automatically when pickups are marked completed.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}