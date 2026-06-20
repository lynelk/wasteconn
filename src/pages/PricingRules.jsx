import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Tag, FlaskConical, History, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const SCOPE_COLORS = {
  global: 'bg-slate-100 text-slate-700',
  zone: 'bg-blue-100 text-blue-700',
  customer_type: 'bg-purple-100 text-purple-700',
  service_plan: 'bg-orange-100 text-orange-700',
  waste_type: 'bg-green-100 text-green-700',
};

const RULE_TYPE_LABELS = {
  distance_surcharge: 'Distance Surcharge',
  contamination_fee: 'Contamination Fee',
  bulky_fee: 'Bulky Fee',
  hazardous_handling: 'Hazardous Handling',
  after_hours: 'After Hours',
  demand_surge: 'Demand Surge',
};

const DEFAULT_FORM = {
  tenant_id: '',
  name: '',
  scope: 'global',
  scope_id: '',
  rule_type: 'distance_surcharge',
  condition_json: '',
  amount_type: 'flat',
  amount: '',
  currency: 'UGX',
  priority: 0,
  active: true,
  effective_from: '',
  effective_to: '',
};

function RuleFormDialog({ rule, tenantId, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(rule ? { ...rule } : { ...DEFAULT_FORM, tenant_id: tenantId });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, amount: parseFloat(form.amount), priority: parseInt(form.priority) };
    if (rule?.id) {
      await base44.entities.PricingRule.update(rule.id, payload);
      toast.success('Rule updated');
    } else {
      await base44.entities.PricingRule.create(payload);
      toast.success('Rule created');
    }
    qc.invalidateQueries({ queryKey: ['pricing-rules'] });
    setSaving(false);
    onClose();
  };

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label>Rule Name <span className="text-destructive">*</span></Label>
          <Input value={form.name} onChange={e => set('name', e.target.value)} required />
        </div>
        <div>
          <Label>Rule Type</Label>
          <Select value={form.rule_type} onValueChange={v => set('rule_type', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(RULE_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Scope</Label>
          <Select value={form.scope} onValueChange={v => set('scope', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {['global','zone','customer_type','service_plan','waste_type'].map(s => (
                <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {form.scope !== 'global' && (
          <div className="col-span-2">
            <Label>Scope ID (zone_id / plan_id etc.)</Label>
            <Input value={form.scope_id} onChange={e => set('scope_id', e.target.value)} placeholder="ID" />
          </div>
        )}
        <div>
          <Label>Amount Type</Label>
          <Select value={form.amount_type} onValueChange={v => set('amount_type', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="flat">Flat</SelectItem>
              <SelectItem value="per_km">Per KM</SelectItem>
              <SelectItem value="per_kg">Per KG</SelectItem>
              <SelectItem value="percentage">Percentage (%)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Amount <span className="text-destructive">*</span></Label>
          <Input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} required min="0" />
        </div>
        <div>
          <Label>Priority (lower = higher priority)</Label>
          <Input type="number" value={form.priority} onChange={e => set('priority', e.target.value)} />
        </div>
        <div className="flex items-center gap-2 mt-6">
          <Switch checked={form.active} onCheckedChange={v => set('active', v)} />
          <Label>Active</Label>
        </div>
        <div>
          <Label>Effective From</Label>
          <Input type="date" value={form.effective_from} onChange={e => set('effective_from', e.target.value)} />
        </div>
        <div>
          <Label>Effective To (optional)</Label>
          <Input type="date" value={form.effective_to} onChange={e => set('effective_to', e.target.value)} />
        </div>
        <div className="col-span-2">
          <Label>Condition JSON (optional)</Label>
          <Textarea
            value={form.condition_json}
            onChange={e => set('condition_json', e.target.value)}
            placeholder='e.g. {"waste_type": "hazardous"} or {"min_weight_kg": 100}'
            rows={2}
            className="font-mono text-xs"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={saving}>{saving ? 'Saving...' : rule?.id ? 'Update Rule' : 'Create Rule'}</Button>
      </div>
    </form>
  );
}

function SimulationModal({ tenantId, onClose }) {
  const [inputs, setInputs] = useState({
    tenant_id: tenantId,
    zone_id: '',
    customer_type: 'residential',
    waste_type: 'general',
    estimated_weight_kg: 50,
    distance_km: 10,
    is_after_hours: false,
    is_bulky: false,
    is_hazardous: false,
    base_amount_ugx: 20000,
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  const setIn = (k, v) => setInputs(p => ({ ...p, [k]: v }));

  const runSimulation = async () => {
    setLoading(true);
    const res = await base44.functions.invoke('computePrice', inputs);
    if (res.data?.total_ugx !== undefined) {
      const entry = { timestamp: new Date().toLocaleTimeString(), inputs: { ...inputs }, result: res.data };
      setHistory(h => [entry, ...h].slice(0, 5));
      setResult(res.data);
    } else {
      toast.error(res.data?.error || 'Simulation failed');
    }
    setLoading(false);
  };

  const replayHistoryEntry = (entry) => {
    setInputs(entry.inputs);
    setResult(entry.result);
  };

  return (
    <div className="flex gap-6 min-h-[400px]">
      {/* Inputs */}
      <div className="flex-1 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Base Amount (UGX)</Label>
            <Input type="number" value={inputs.base_amount_ugx} onChange={e => setIn('base_amount_ugx', +e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Distance (km)</Label>
            <Input type="number" value={inputs.distance_km} onChange={e => setIn('distance_km', +e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Weight (kg)</Label>
            <Input type="number" value={inputs.estimated_weight_kg} onChange={e => setIn('estimated_weight_kg', +e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Waste Type</Label>
            <Select value={inputs.waste_type} onValueChange={v => setIn('waste_type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['general','recyclable','organic','hazardous','e_waste','bulky'].map(t => (
                  <SelectItem key={t} value={t}>{t.replace('_', ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Customer Type</Label>
            <Select value={inputs.customer_type} onValueChange={v => setIn('customer_type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="residential">Residential</SelectItem>
                <SelectItem value="commercial">Commercial</SelectItem>
                <SelectItem value="industrial">Industrial</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Zone ID (optional)</Label>
            <Input value={inputs.zone_id} onChange={e => setIn('zone_id', e.target.value)} placeholder="Zone ID" />
          </div>
        </div>
        <div className="flex gap-4 flex-wrap">
          {[['is_after_hours', 'After Hours'], ['is_bulky', 'Bulky'], ['is_hazardous', 'Hazardous']].map(([k, lbl]) => (
            <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
              <Switch checked={inputs[k]} onCheckedChange={v => setIn(k, v)} />
              {lbl}
            </label>
          ))}
        </div>
        <Button onClick={runSimulation} disabled={loading} className="w-full gap-2">
          <FlaskConical className="w-4 h-4" />
          {loading ? 'Running...' : 'Run Simulation'}
        </Button>

        {/* Result */}
        {result && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Base Amount</span>
              <span>{result.base_amount_ugx?.toLocaleString()} UGX</span>
            </div>
            {result.surcharges?.map((s, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{s.rule_name}</span>
                <span className="text-orange-600">+{s.amount_ugx?.toLocaleString()} UGX</span>
              </div>
            ))}
            <div className="border-t pt-2 flex justify-between font-bold">
              <span>Total</span>
              <span className="text-primary text-lg">{result.total_ugx?.toLocaleString()} UGX</span>
            </div>
          </div>
        )}
      </div>

      {/* History Panel */}
      {history.length > 0 && (
        <div className="w-52 border-l pl-4 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-3">
            <History className="w-3.5 h-3.5" /> History
          </div>
          {history.map((entry, i) => (
            <div key={i} className="rounded-lg border p-2 text-xs space-y-1 cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => replayHistoryEntry(entry)}>
              <div className="flex justify-between text-muted-foreground">
                <span>{entry.timestamp}</span>
                <RotateCcw className="w-3 h-3" />
              </div>
              <div className="font-semibold">{entry.result.total_ugx?.toLocaleString()} UGX</div>
              <div className="text-muted-foreground">{entry.inputs.waste_type} · {entry.inputs.distance_km}km</div>
              <div className="text-muted-foreground">{entry.result.surcharges?.length || 0} surcharges</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PricingRules() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editRule, setEditRule] = useState(null);
  const [showSim, setShowSim] = useState(false);

  const tenantId = user?.tenant_id || '';

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['pricing-rules'],
    queryFn: () => base44.entities.PricingRule.list('priority', 200),
  });

  if (!['admin', 'super_admin'].includes(user?.role)) {
    return <div className="p-8 text-center text-muted-foreground">Access restricted to administrators.</div>;
  }

  const toggleActive = async (rule) => {
    await base44.entities.PricingRule.update(rule.id, { active: !rule.active });
    qc.invalidateQueries({ queryKey: ['pricing-rules'] });
    toast.success(`Rule ${!rule.active ? 'activated' : 'deactivated'}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-jakarta">Pricing Rules</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Configure billing rules and surcharges</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowSim(true)} className="gap-2">
            <FlaskConical className="w-4 h-4" /> Simulate Quote
          </Button>
          <Button onClick={() => { setEditRule(null); setShowForm(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> New Rule
          </Button>
        </div>
      </div>

      {/* Rules Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">Loading rules...</div>
        ) : rules.length === 0 ? (
          <div className="p-12 text-center">
            <Tag className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No pricing rules defined yet.</p>
            <Button className="mt-4" onClick={() => setShowForm(true)}>Create First Rule</Button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Priority</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Scope</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Validity</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Active</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rules.map(rule => (
                <tr key={rule.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{rule.priority ?? 0}</td>
                  <td className="px-4 py-3 font-medium">{rule.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${SCOPE_COLORS[rule.scope] || ''}`}>
                      {rule.scope}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{RULE_TYPE_LABELS[rule.rule_type] || rule.rule_type}</td>
                  <td className="px-4 py-3 font-medium">
                    {rule.amount_type === 'percentage' ? `${rule.amount}%` : `${rule.amount?.toLocaleString()} ${rule.currency || 'UGX'}`}
                    <span className="text-xs text-muted-foreground ml-1">/ {rule.amount_type?.replace('_', ' ')}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {rule.effective_from ? format(new Date(rule.effective_from), 'dd MMM yy') : '—'}
                    {rule.effective_to ? ` → ${format(new Date(rule.effective_to), 'dd MMM yy')}` : rule.effective_from ? ' →' : ''}
                  </td>
                  <td className="px-4 py-3">
                    <Switch checked={!!rule.active} onCheckedChange={() => toggleActive(rule)} />
                  </td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="ghost" onClick={() => { setEditRule(rule); setShowForm(true); }}>Edit</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Rule Form Dialog */}
      <Dialog open={showForm} onOpenChange={v => { setShowForm(v); if (!v) setEditRule(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editRule ? 'Edit Rule' : 'New Pricing Rule'}</DialogTitle>
          </DialogHeader>
          <RuleFormDialog rule={editRule} tenantId={tenantId} onClose={() => { setShowForm(false); setEditRule(null); }} />
        </DialogContent>
      </Dialog>

      {/* Simulation Modal */}
      <Dialog open={showSim} onOpenChange={setShowSim}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-primary" /> Pricing Simulation
            </DialogTitle>
          </DialogHeader>
          <SimulationModal tenantId={tenantId} onClose={() => setShowSim(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}