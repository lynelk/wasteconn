import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Database, Brain, AlertTriangle, CheckCircle, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const riskColors = {
  low: 'bg-green-50 text-green-700 border-green-200',
  medium: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  critical: 'bg-red-50 text-red-700 border-red-200',
};

const ENTITIES = ['Customer','ServicePoint','Contract','PickupRequest','Route','Invoice','Payment','Receipt','Statement','EvidenceBundle','Complaint','Tenant','ServiceZone','Vehicle','ServicePlan','Subscription','AuditLog','RBACRole','Product','CustomerOrder'];
const CHANGE_TYPES = ['add_field','remove_field','rename_field','change_type','add_index','remove_index','add_relation','other'];

export default function SchemaEvolution() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ entity_name: '', change_type: 'add_field', proposed_change: '', description: '' });
  const [analysing, setAnalysing] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const { data: proposals = [], isLoading } = useQuery({
    queryKey: ['schema-proposals'],
    queryFn: () => base44.entities.SchemaEvolutionProposal.list('-created_date', 50),
  });

  const approveMutation = useMutation({
    mutationFn: id => base44.entities.SchemaEvolutionProposal.update(id, { status: 'approved' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schema-proposals'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: id => base44.entities.SchemaEvolutionProposal.update(id, { status: 'rejected' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schema-proposals'] }),
  });

  const handleAnalyse = async () => {
    if (!form.entity_name || !form.proposed_change) return;
    setAnalysing(true);
    try {
      const res = await base44.functions.invoke('aiSchemaEvolutionAssistant', form);
      setLastResult(res.data);
      qc.invalidateQueries({ queryKey: ['schema-proposals'] });
      setShowForm(false);
    } finally {
      setAnalysing(false);
    }
  };

  const breakingCount = proposals.filter(p => p.breaking_changes?.length > 0).length;
  const pendingCount = proposals.filter(p => p.status === 'ai_analysis_complete').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-jakarta flex items-center gap-2">
            <Database className="w-6 h-6 text-primary" /> Schema Evolution AI
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Propose schema changes and get AI-powered impact analysis before applying</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          <Plus className="w-4 h-4" /> New Proposal
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Proposals', value: proposals.length, color: 'text-primary' },
          { label: 'Pending Review', value: pendingCount, color: pendingCount > 0 ? 'text-yellow-600' : 'text-muted-foreground' },
          { label: 'With Breaking Changes', value: breakingCount, color: breakingCount > 0 ? 'text-red-600' : 'text-muted-foreground' },
        ].map(s => (
          <Card key={s.label} className="border-border/60">
            <CardContent className="pt-4 pb-4">
              <div className={`text-2xl font-bold font-jakarta ${s.color}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Proposal Form */}
      {showForm && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3 pt-5">
            <CardTitle className="text-base font-jakarta">New Schema Change Proposal</CardTitle>
          </CardHeader>
          <CardContent className="pb-5 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Entity *</Label>
                <Select value={form.entity_name} onValueChange={v => setForm(f => ({ ...f, entity_name: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select entity…" /></SelectTrigger>
                  <SelectContent>{ENTITIES.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Change Type *</Label>
                <Select value={form.change_type} onValueChange={v => setForm(f => ({ ...f, change_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CHANGE_TYPES.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g,' ')}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Proposed Change (JSON or description) *</Label>
              <textarea
                className="w-full min-h-24 rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder={'{"field_name": "new_status", "type": "string", "enum": ["active","inactive"]}'}
                value={form.proposed_change}
                onChange={e => setForm(f => ({ ...f, proposed_change: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Additional Context</Label>
              <Input placeholder="Why is this change needed?" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleAnalyse} disabled={analysing || !form.entity_name || !form.proposed_change} className="gap-2">
                <Brain className={`w-4 h-4 ${analysing ? 'animate-pulse' : ''}`} />
                {analysing ? 'Analysing Impact…' : 'Analyse with AI'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Last result inline */}
      {lastResult && (
        <Card className={`border ${riskColors[lastResult.risk_level]}`}>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="w-4 h-4" /> AI Analysis — {lastResult.entity_name} · {lastResult.change_type}
              <Badge className={`text-xs ml-auto border ${riskColors[lastResult.risk_level]}`} variant="outline">
                {lastResult.risk_level} risk
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 space-y-3">
            {lastResult.breaking_changes?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-700 mb-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Breaking Changes</p>
                <ul className="space-y-1">
                  {lastResult.breaking_changes.map((c, i) => <li key={i} className="text-xs text-red-600">• {c}</li>)}
                </ul>
              </div>
            )}
            {lastResult.downstream_impact && (
              <div>
                <p className="text-xs font-semibold mb-1">Downstream Impact</p>
                <p className="text-xs text-muted-foreground">{lastResult.downstream_impact}</p>
              </div>
            )}
            {lastResult.migration_path && (
              <div>
                <p className="text-xs font-semibold mb-1">Migration Path</p>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{lastResult.migration_path}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Proposals List */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold font-jakarta">Proposal History</h3>
        {isLoading ? [1,2,3].map(i => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />) :
          proposals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <Database className="w-8 h-8 mx-auto mb-3 opacity-30" />
              No proposals yet. Create one to get started.
            </div>
          ) : proposals.map(p => <ProposalCard key={p.id} proposal={p} onApprove={() => approveMutation.mutate(p.id)} onReject={() => rejectMutation.mutate(p.id)} />)
        }
      </div>
    </div>
  );
}

function ProposalCard({ proposal, onApprove, onReject }) {
  const [expanded, setExpanded] = useState(false);

  const statusColors = {
    draft: 'bg-gray-100 text-gray-600',
    ai_analysis_pending: 'bg-yellow-100 text-yellow-700',
    ai_analysis_complete: 'bg-blue-100 text-blue-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    applied: 'bg-purple-100 text-purple-700',
  };

  return (
    <Card className="border-border/60">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-semibold text-sm font-jakarta">{proposal.entity_name}</span>
              <Badge variant="secondary" className="text-xs">{proposal.change_type?.replace(/_/g,' ')}</Badge>
              <Badge className={`text-xs ${statusColors[proposal.status] || 'bg-muted text-muted-foreground'}`} variant="secondary">
                {proposal.status?.replace(/_/g,' ')}
              </Badge>
              {proposal.risk_level && (
                <Badge className={`text-xs border ${riskColors[proposal.risk_level]}`} variant="outline">{proposal.risk_level} risk</Badge>
              )}
            </div>
            {proposal.breaking_changes?.length > 0 && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {proposal.breaking_changes.length} breaking change{proposal.breaking_changes.length !== 1 ? 's' : ''}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">
              By {proposal.proposed_by || '—'} · {proposal.created_date ? format(new Date(proposal.created_date), 'MMM d, yyyy') : ''}
            </p>
            <button onClick={() => setExpanded(!expanded)} className="text-xs text-primary hover:underline mt-1 flex items-center gap-1">
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? 'Hide' : 'View'} Analysis
            </button>
            {expanded && (
              <div className="mt-3 space-y-2 border-t border-border/40 pt-3">
                {proposal.ai_impact_analysis && (
                  <div>
                    <p className="text-xs font-medium mb-1">AI Impact Analysis</p>
                    <p className="text-xs text-muted-foreground">{proposal.ai_impact_analysis}</p>
                  </div>
                )}
                {proposal.migration_suggestion && (
                  <div>
                    <p className="text-xs font-medium mb-1">Migration Suggestion</p>
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{proposal.migration_suggestion}</p>
                  </div>
                )}
                {proposal.breaking_changes?.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-red-600 mb-1">Breaking Changes</p>
                    {proposal.breaking_changes.map((c, i) => <p key={i} className="text-xs text-red-500">• {c}</p>)}
                  </div>
                )}
              </div>
            )}
          </div>
          {proposal.status === 'ai_analysis_complete' && (
            <div className="flex gap-1 shrink-0">
              <Button size="sm" className="h-7 text-xs px-2" onClick={onApprove}>Approve</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs px-2 text-red-600 border-red-200 hover:bg-red-50" onClick={onReject}>Reject</Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}