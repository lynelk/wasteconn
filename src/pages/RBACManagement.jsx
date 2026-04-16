import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Shield, Plus, Edit2, Trash2, AlertTriangle, Brain, RefreshCw, CheckCircle, Clock, Lock, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import RBACRoleForm from '@/components/rbac/RBACRoleForm';
import PermissionRecommendationsPanel from '@/components/rbac/PermissionRecommendationsPanel';

const roleTypeColors = {
  super_admin: 'bg-red-100 text-red-700',
  city_admin: 'bg-blue-100 text-blue-700',
  city_analyst: 'bg-blue-50 text-blue-600',
  operator_admin: 'bg-green-100 text-green-700',
  operator_manager: 'bg-green-50 text-green-600',
  dispatcher: 'bg-yellow-100 text-yellow-700',
  driver: 'bg-orange-100 text-orange-700',
  field_agent: 'bg-orange-50 text-orange-600',
  billing_officer: 'bg-purple-100 text-purple-700',
  compliance_officer: 'bg-indigo-100 text-indigo-700',
  customer: 'bg-gray-100 text-gray-600',
  support_agent: 'bg-cyan-100 text-cyan-700',
  readonly: 'bg-gray-100 text-gray-500',
};

export default function RBACManagement() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [aiRunning, setAiRunning] = useState(false);
  const [aiResults, setAiResults] = useState(null);

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['rbac-roles'],
    queryFn: () => base44.entities.RBACRole.list('-created_date'),
  });

  const { data: usageRecords = [] } = useQuery({
    queryKey: ['rbac-usage'],
    queryFn: () => base44.entities.RBACPermissionUsage.list('-last_used_at', 200),
  });

  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.RBACRole.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rbac-roles'] }),
  });

  const dormantCount = usageRecords.filter(r => r.is_dormant).length;
  const flaggedCount = usageRecords.filter(r => r.ml_flagged_for_review).length;

  const runAiRecommender = async () => {
    setAiRunning(true);
    try {
      const res = await base44.functions.invoke('aiPermissionRecommender', { dormant_days: 30 });
      setAiResults(res.data);
      qc.invalidateQueries({ queryKey: ['rbac-usage'] });
    } finally {
      setAiRunning(false);
    }
  };

  const systemRoles = roles.filter(r => r.is_system_role);
  const customRoles = roles.filter(r => !r.is_system_role);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-jakarta flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" /> RBAC Management
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Role-based access control, permission scopes and ML recommendations</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={runAiRecommender} disabled={aiRunning} className="gap-2">
            <Brain className={`w-4 h-4 ${aiRunning ? 'animate-pulse' : ''}`} />
            {aiRunning ? 'Analysing…' : 'ML Recommendations'}
          </Button>
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Add Role
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Roles', value: roles.length, color: 'text-primary' },
          { label: 'System Roles', value: systemRoles.length, color: 'text-blue-600' },
          { label: 'Custom Roles', value: customRoles.length, color: 'text-green-600' },
          { label: 'Dormant Permissions', value: dormantCount, color: dormantCount > 0 ? 'text-orange-600' : 'text-muted-foreground' },
        ].map(s => (
          <Card key={s.label} className="border-border/60">
            <CardContent className="pt-4 pb-4">
              <div className={`text-2xl font-bold font-jakarta ${s.color}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dormant Permission Alert */}
      {dormantCount > 0 && (
        <div className="flex items-start gap-3 p-4 bg-orange-50 border border-orange-200 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-orange-800">{dormantCount} dormant permissions flagged for review</p>
            <p className="text-xs text-orange-600 mt-0.5">These permissions haven't been used in 30+ days. Run ML Recommendations to get least-privilege suggestions.</p>
          </div>
        </div>
      )}

      <Tabs defaultValue="system">
        <TabsList>
          <TabsTrigger value="system">System Roles ({systemRoles.length})</TabsTrigger>
          <TabsTrigger value="custom">Custom Roles ({customRoles.length})</TabsTrigger>
          <TabsTrigger value="usage">Permission Usage</TabsTrigger>
          {aiResults && <TabsTrigger value="ai">AI Insights</TabsTrigger>}
        </TabsList>

        <TabsContent value="system" className="space-y-3 mt-4">
          {isLoading ? (
            [1,2,3].map(i => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)
          ) : systemRoles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <Shield className="w-8 h-8 mx-auto mb-3 opacity-30" />
              No system roles yet. <Button variant="link" className="px-0" onClick={() => base44.functions.invoke('seedFoundationData', {})}>Seed foundation data</Button>
            </div>
          ) : (
            systemRoles.map(role => <RoleCard key={role.id} role={role} onEdit={() => { setEditing(role); setOpen(true); }} onDelete={() => !role.is_system_role && deleteMutation.mutate(role.id)} />)
          )}
        </TabsContent>

        <TabsContent value="custom" className="space-y-3 mt-4">
          {customRoles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No custom roles defined. <button onClick={() => { setEditing(null); setOpen(true); }} className="text-primary hover:underline">Create one</button>
            </div>
          ) : customRoles.map(role => (
            <RoleCard key={role.id} role={role} onEdit={() => { setEditing(role); setOpen(true); }} onDelete={() => deleteMutation.mutate(role.id)} showDelete />
          ))}
        </TabsContent>

        <TabsContent value="usage" className="mt-4">
          <PermissionUsageTable records={usageRecords} />
        </TabsContent>

        {aiResults && (
          <TabsContent value="ai" className="mt-4">
            <PermissionRecommendationsPanel results={aiResults} />
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={open} onOpenChange={() => { setOpen(false); setEditing(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-jakarta">{editing ? 'Edit Role' : 'Create Role'}</DialogTitle>
          </DialogHeader>
          <RBACRoleForm role={editing} onClose={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ['rbac-roles'] }); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RoleCard({ role, onEdit, onDelete, showDelete }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className="border-border/60 hover:shadow-sm transition-shadow">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              {role.is_system_role ? <Lock className="w-4 h-4 text-primary" /> : <Unlock className="w-4 h-4 text-primary" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm font-jakarta">{role.role_name}</p>
                <Badge className={`text-xs ${roleTypeColors[role.role_type] || 'bg-muted text-muted-foreground'}`} variant="secondary">
                  {role.role_type}
                </Badge>
                {role.is_system_role && <Badge variant="outline" className="text-xs">System</Badge>}
                {role.status === 'inactive' && <Badge variant="destructive" className="text-xs">Inactive</Badge>}
              </div>
              {role.description && <p className="text-xs text-muted-foreground mt-0.5">{role.description}</p>}
              <div className="flex items-center gap-2 mt-2">
                <button onClick={() => setExpanded(!expanded)} className="text-xs text-primary hover:underline">
                  {expanded ? 'Hide' : 'Show'} {role.permissions?.length || 0} permissions · {role.scopes?.length || 0} scopes
                </button>
              </div>
              {expanded && (
                <div className="mt-2 space-y-2">
                  {role.scopes?.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Scopes</p>
                      <div className="flex flex-wrap gap-1">
                        {role.scopes.map(s => <Badge key={s} variant="outline" className="text-xs font-mono">{s}</Badge>)}
                      </div>
                    </div>
                  )}
                  {role.permissions?.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Permissions</p>
                      <div className="flex flex-wrap gap-1">
                        {role.permissions.map(p => <Badge key={p} variant="secondary" className="text-xs font-mono">{p}</Badge>)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            <button onClick={onEdit} className="text-muted-foreground hover:text-foreground p-1 transition-colors">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            {showDelete && !role.is_system_role && (
              <button onClick={onDelete} className="text-muted-foreground hover:text-destructive p-1 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PermissionUsageTable({ records }) {
  const dormant = records.filter(r => r.is_dormant);
  const flagged = records.filter(r => r.ml_flagged_for_review);
  const displayed = records.slice(0, 50);

  return (
    <div className="space-y-4">
      {(dormant.length > 0 || flagged.length > 0) && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm flex items-center gap-2 text-orange-700">
                <Clock className="w-4 h-4" /> Dormant Permissions ({dormant.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              {dormant.slice(0,5).map(r => (
                <div key={r.id} className="flex items-center justify-between py-1 text-xs">
                  <span className="font-mono text-orange-800">{r.permission}</span>
                  <span className="text-orange-600">{r.user_email}</span>
                </div>
              ))}
              {dormant.length > 5 && <p className="text-xs text-orange-500 mt-1">+{dormant.length - 5} more</p>}
            </CardContent>
          </Card>
          <Card className="border-red-200 bg-red-50">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm flex items-center gap-2 text-red-700">
                <AlertTriangle className="w-4 h-4" /> ML Flagged ({flagged.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              {flagged.slice(0,5).map(r => (
                <div key={r.id} className="flex items-center justify-between py-1 text-xs">
                  <span className="font-mono text-red-800">{r.permission}</span>
                  <span className="text-red-600">{r.ml_least_privilege_suggestion || r.user_email}</span>
                </div>
              ))}
              {flagged.length > 5 && <p className="text-xs text-red-500 mt-1">+{flagged.length - 5} more</p>}
            </CardContent>
          </Card>
        </div>
      )}

      {records.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">No permission usage records yet.</div>
      ) : (
        <Card className="border-border/60">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    {['User','Permission','Role','30d Uses','Last Used','Status'].map(h => (
                      <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayed.map(r => (
                    <tr key={r.id} className={`border-b border-border/40 ${r.is_dormant ? 'bg-orange-50/30' : ''}`}>
                      <td className="px-4 py-2.5 text-xs">{r.user_email}</td>
                      <td className="px-4 py-2.5 text-xs font-mono">{r.permission}</td>
                      <td className="px-4 py-2.5 text-xs">{r.role_type || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-center">{r.use_count_30d || 0}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.last_used_at ? new Date(r.last_used_at).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-2.5">
                        {r.is_dormant
                          ? <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700">Dormant</Badge>
                          : <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">Active</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}