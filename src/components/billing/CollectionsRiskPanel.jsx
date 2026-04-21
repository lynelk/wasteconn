import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { logger } from '@/lib/logger';
import { RefreshCw, Zap, TrendingDown, Phone, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const tierColors = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-green-100 text-green-700 border-green-200',
};

const tierBadge = {
  critical: 'bg-red-500 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-400 text-yellow-900',
  low: 'bg-green-100 text-green-700',
};

function RiskRow({ account }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`border rounded-xl p-3 ${tierColors[account.tier] || 'bg-muted'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="text-center shrink-0 w-10">
            <div className="text-base font-bold font-jakarta">{account.risk_score}</div>
            <div className="text-xs opacity-60">score</div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{account.customer_name}</p>
            <p className="text-xs opacity-70">{account.tier_action}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge className={`text-xs ${tierBadge[account.tier]}`} variant="secondary">{account.tier}</Badge>
          {account.phone && (
            <a href={`tel:${account.phone}`} className="opacity-60 hover:opacity-100">
              <Phone className="w-3.5 h-3.5" />
            </a>
          )}
          <button onClick={() => setExpanded(!expanded)} className="opacity-60 hover:opacity-100">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="mt-2 pt-2 border-t border-current/20 grid grid-cols-3 gap-2 text-xs">
          <div><span className="opacity-60">Overdue:</span> <strong>{account.overdue_count}</strong></div>
          <div><span className="opacity-60">Outstanding:</span> <strong>{(account.outstanding_ugx / 1000).toFixed(0)}K UGX</strong></div>
          <div><span className="opacity-60">Pay Rate:</span> <strong>{account.payment_rate}%</strong></div>
          <div><span className="opacity-60">Last Pay:</span> <strong>{account.days_since_payment != null ? `${account.days_since_payment}d ago` : 'Never'}</strong></div>
          <div><span className="opacity-60">Type:</span> <strong className="capitalize">{account.customer_type}</strong></div>
        </div>
      )}
    </div>
  );
}

export default function CollectionsRiskPanel() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [filter, setFilter] = useState('all');

  const handleRun = async () => {
    setRunning(true);
    try {
      const res = await base44.functions.invoke('aiCollectionsRisk', {});
      setResults(res.data);
    } catch (e) {
      logger.error('collections.riskPanel.error', { message: e?.message });
    } finally {
      setRunning(false);
    }
  };

  const filtered = results?.accounts?.filter(a => filter === 'all' || a.tier === filter) || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-sm">AI Collections Risk Scoring</p>
          <p className="text-xs text-muted-foreground mt-0.5">Predict payment probability and auto-assign to collections tiers</p>
        </div>
        <Button size="sm" onClick={handleRun} disabled={running} className="gap-2">
          {running ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          {running ? 'Scoring...' : 'Run AI Scoring'}
        </Button>
      </div>

      {!results ? (
        <div className="text-center py-10 text-muted-foreground border border-dashed rounded-xl">
          <TrendingDown className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Click "Run AI Scoring" to analyse all active accounts</p>
        </div>
      ) : (
        <>
          {/* Tier summary */}
          <div className="grid grid-cols-4 gap-2">
            {['critical', 'high', 'medium', 'low'].map(tier => {
              const count = results.accounts.filter(a => a.tier === tier).length;
              return (
                <button
                  key={tier}
                  onClick={() => setFilter(filter === tier ? 'all' : tier)}
                  className={`text-center p-2 rounded-xl border transition-all ${filter === tier ? 'ring-2 ring-primary' : ''} ${tierColors[tier]}`}
                >
                  <div className="text-lg font-bold font-jakarta">{count}</div>
                  <div className="text-xs capitalize">{tier}</div>
                </button>
              );
            })}
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <p className="text-center py-6 text-sm text-muted-foreground">No accounts in this tier</p>
            ) : (
              filtered.map(a => <RiskRow key={a.customer_id} account={a} />)
            )}
          </div>

          {results.scored_at && (
            <p className="text-xs text-muted-foreground text-right">Scored at {new Date(results.scored_at).toLocaleString()}</p>
          )}
        </>
      )}
    </div>
  );
}