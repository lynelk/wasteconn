import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { RefreshCw, Brain, AlertTriangle, Info, CheckCircle, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const severityIcon = {
  critical: <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />,
  warning: <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0" />,
  info: <Info className="w-4 h-4 text-blue-400 shrink-0" />,
};

const severityBadge = {
  critical: 'bg-red-100 text-red-700',
  warning: 'bg-orange-100 text-orange-700',
  info: 'bg-blue-100 text-blue-700',
};

export default function ZoneCoverageAI() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const handleAnalyse = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('aiZoneCoverageAnalysis', {});
      setResults(res.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="bg-card border border-border/60 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          <div>
            <p className="font-semibold text-sm">AI Coverage Gap Analysis</p>
            <p className="text-xs text-muted-foreground">Spatial intelligence for zone design</p>
          </div>
        </div>
        <Button size="sm" onClick={handleAnalyse} disabled={running} variant="outline" className="gap-2">
          {running ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
          {running ? 'Analysing...' : 'Analyse Coverage'}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!results && !error && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Run analysis to get AI-powered zone recommendations based on your service points and customer distribution.
        </p>
      )}

      {results?.message && (
        <p className="text-sm text-muted-foreground">{results.message}</p>
      )}

      {results?.summary && (
        <div className="mb-3 p-3 bg-primary/5 rounded-lg">
          <p className="text-sm text-foreground">{results.summary}</p>
        </div>
      )}

      {results?.insights?.length > 0 && (
        <div className="space-y-2">
          {results.insights.map((ins, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
              {severityIcon[ins.severity] || <Info className="w-4 h-4 text-muted-foreground shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-semibold">{ins.title}</p>
                  <Badge variant="secondary" className={`text-xs ${severityBadge[ins.severity] || ''}`}>{ins.severity}</Badge>
                  {ins.zone_name && (
                    <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                      <MapPin className="w-3 h-3" />{ins.zone_name}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{ins.description}</p>
                {ins.suggested_action && (
                  <p className="text-xs text-primary mt-1 font-medium">→ {ins.suggested_action}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {results && (
        <p className="text-xs text-muted-foreground text-right mt-2">
          Analysed {results.zone_stats?.length || 0} zones · {new Date(results.analysed_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}