import { Brain, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function PermissionRecommendationsPanel({ results }) {
  if (!results) return null;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm flex items-center gap-2 text-primary">
            <Brain className="w-4 h-4" /> ML Analysis Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <p className="text-sm text-foreground">{results.summary}</p>
          <div className="flex gap-4 mt-3">
            <div className="text-center">
              <div className="text-xl font-bold font-jakarta text-orange-600">{results.dormant_permissions_flagged}</div>
              <div className="text-xs text-muted-foreground">Dormant</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold font-jakarta text-primary">{results.role_recommendations?.length || 0}</div>
              <div className="text-xs text-muted-foreground">Role Recommendations</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Narrative */}
      {results.ai_analysis && (
        <Card className="border-border/60">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm text-foreground">AI Security Recommendations</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{results.ai_analysis}</p>
          </CardContent>
        </Card>
      )}

      {/* Per-Role Breakdowns */}
      {results.role_recommendations?.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold font-jakarta">Per-Role Least-Privilege Breakdown</h3>
          {results.role_recommendations.map((rec, i) => (
            <Card key={i} className="border-border/60">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary" className="text-xs font-mono">{rec.role_type}</Badge>
                      <span className="text-xs text-muted-foreground">{rec.usage_ratio}% utilisation</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{rec.suggestion}</p>
                    {rec.unused_list?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {rec.unused_list.slice(0,8).map(p => (
                          <Badge key={p} variant="outline" className="text-xs font-mono text-orange-600 border-orange-200">{p}</Badge>
                        ))}
                        {rec.unused_list.length > 8 && <Badge variant="outline" className="text-xs">+{rec.unused_list.length - 8} more</Badge>}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold font-jakarta text-green-600">{rec.used_permissions}</div>
                    <div className="text-xs text-muted-foreground">used / {rec.total_permissions}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dormant details */}
      {results.dormant_details?.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold font-jakarta flex items-center gap-2 text-orange-700">
            <AlertTriangle className="w-4 h-4" /> Dormant Permissions ({results.dormant_details.length})
          </h3>
          <Card className="border-orange-200">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-orange-50 border-b border-orange-200">
                      {['User','Permission','Last Used'].map(h => (
                        <th key={h} className="text-left text-xs font-medium text-orange-700 px-4 py-2">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.dormant_details.map((d, i) => (
                      <tr key={i} className="border-b border-orange-100">
                        <td className="px-4 py-2 text-xs">{d.user}</td>
                        <td className="px-4 py-2 text-xs font-mono">{d.permission}</td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">{d.last_used ? new Date(d.last_used).toLocaleDateString() : 'Never'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}