import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, addMonths } from 'date-fns';
import { Sparkles, Loader2, Upload, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import EntitySelect from '@/components/common/EntitySelect';

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];

export default function ContractForm({ subscription, plans, onClose, onSaved }) {
  const { toast } = useToast();

  const [form, setForm] = useState({
    customer_id: subscription?.customer_id || '',
    plan_id: subscription?.plan_id || '',
    service_point_id: subscription?.service_point_id || '',
    billing_model: subscription?.billing_model || 'postpaid',
    status: subscription?.status || 'pending',
    start_date: subscription?.start_date || format(new Date(), 'yyyy-MM-dd'),
    end_date: subscription?.end_date || '',
    contract_duration_months: subscription?.contract_duration_months || 12,
    auto_renew: subscription?.auto_renew !== false,
    service_frequency: subscription?.service_frequency || 'weekly',
    collection_days: subscription?.collection_days || [],
    payment_method: subscription?.payment_method || 'cash',
    discount_pct: subscription?.discount_pct || 0,
    discount_reason: subscription?.discount_reason || '',
    contract_signed: subscription?.contract_signed || false,
    contract_signed_date: subscription?.contract_signed_date || '',
    contract_document_url: subscription?.contract_document_url || '',
    contract_version: subscription?.contract_version || 1,
    terms_and_conditions_version: subscription?.terms_and_conditions_version || '',
    early_termination_fee_ugx: subscription?.early_termination_fee_ugx || 0,
    sales_agent_id: subscription?.sales_agent_id || '',
    notes: subscription?.notes || '',
    ai_recommended_plan: subscription?.ai_recommended_plan || false,
    ai_recommendation_notes: subscription?.ai_recommendation_notes || '',
  });

  const [aiLoading, setAiLoading] = useState(false);
  const [aiRecs, setAiRecs] = useState(null);
  const [uploading, setUploading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Auto-set end date from duration
  useEffect(() => {
    if (form.start_date && form.contract_duration_months) {
      set('end_date', format(addMonths(new Date(form.start_date), form.contract_duration_months), 'yyyy-MM-dd'));
    }
  }, [form.start_date, form.contract_duration_months]);

  // Fetch only the selected customer's service points (not the whole table).
  const { data: filteredSPs = [] } = useQuery({
    queryKey: ['service-points', form.customer_id],
    queryFn: () => base44.entities.ServicePoint.filter({ customer_id: form.customer_id }, undefined, 100),
    enabled: !!form.customer_id,
  });
  const selectedPlan = plans.find(p => p.id === form.plan_id);

  // AI Recommendation
  const fetchAiRec = async () => {
    if (!form.customer_id) return;
    setAiLoading(true);
    try {
      const res = await base44.functions.invoke('aiTariffRecommendation', { customer_id: form.customer_id });
      setAiRecs(res.data);
    } catch (err) {
      toast({ title: 'AI recommendation failed', variant: 'destructive' });
    } finally {
      setAiLoading(false);
    }
  };

  const applyAiPlan = (rec) => {
    setForm(f => ({
      ...f,
      plan_id: rec.plan_id,
      ai_recommended_plan: true,
      ai_recommendation_notes: rec.reasons.join('; '),
    }));
    if (aiRecs?.discount_suggestion) {
      setForm(f => ({
        ...f,
        discount_pct: aiRecs.discount_suggestion.discount_pct,
        discount_reason: aiRecs.discount_suggestion.reason,
      }));
    }
  };

  const toggleDay = (d) => {
    setForm(f => ({
      ...f,
      collection_days: f.collection_days.includes(d) ? f.collection_days.filter(x => x !== d) : [...f.collection_days, d],
    }));
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      set('contract_document_url', res.file_url);
      toast({ title: 'Contract document uploaded' });
    } catch {
      toast({ title: 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    const data = { ...form };
    if (selectedPlan) {
      const baseAmount = selectedPlan.price_ugx || 0;
      data.amount_ugx = Math.round(baseAmount * (1 - (data.discount_pct / 100)));
    }
    // On update: bump version and record amendment if plan changed
    if (subscription?.id && subscription.plan_id !== data.plan_id) {
      const prevHistory = subscription.amendment_history || [];
      data.contract_version = (subscription.contract_version || 1) + 1;
      data.amendment_history = [
        ...prevHistory,
        {
          amended_at: new Date().toISOString(),
          amended_by: 'user',
          version: data.contract_version,
          summary: `Plan changed from ${subscription.plan_id} to ${data.plan_id}`,
          previous_plan_id: subscription.plan_id,
          previous_amount_ugx: subscription.amount_ugx || 0,
        },
      ];
    }
    if (subscription?.id) {
      await base44.entities.Subscription.update(subscription.id, data);
    } else {
      await base44.entities.Subscription.create(data);
    }
    onSaved();
  };

  return (
    <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
      {/* Customer & Plan */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Customer *</Label>
          <EntitySelect
            entity="Customer"
            value={form.customer_id}
            onChange={(id) => { setForm(f => ({ ...f, customer_id: id, service_point_id: '' })); setAiRecs(null); }}
            searchFields={['full_name', 'phone']}
            getLabel={(c) => `${c.full_name}${c.customer_segment || c.customer_type ? ` — ${c.customer_segment || c.customer_type}` : ''}`}
            placeholder="Select customer..."
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>Service Plan *</Label>
            <Button variant="ghost" size="sm" onClick={fetchAiRec} disabled={!form.customer_id || aiLoading} className="text-xs gap-1 h-6 text-primary">
              {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              AI Suggest
            </Button>
          </div>
          <Select value={form.plan_id} onValueChange={v => set('plan_id', v)}>
            <SelectTrigger><SelectValue placeholder="Select plan..." /></SelectTrigger>
            <SelectContent>
              {plans.map(p => <SelectItem key={p.id} value={p.id}>{p.plan_name} — {(p.price_ugx||0).toLocaleString()} UGX</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* AI Recommendations */}
      {aiRecs && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4 pb-4 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">AI Plan Recommendations</span>
              {aiRecs.churn_risk_score > 0 && (
                <Badge variant="secondary" className={`text-xs ${aiRecs.churn_risk_score >= 50 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  Churn risk: {aiRecs.churn_risk_score}%
                </Badge>
              )}
            </div>
            <div className="space-y-2">
              {aiRecs.plan_recommendations?.map((rec, i) => (
                <div key={rec.plan_id} className="flex items-center justify-between bg-card rounded-lg p-2.5 border border-border/60">
                  <div>
                    <div className="text-sm font-medium">{i === 0 && '🏆 '}{rec.plan_name}</div>
                    <div className="text-xs text-muted-foreground">{(rec.price_ugx||0).toLocaleString()} UGX/{rec.billing_cycle} · Score: {rec.score}</div>
                    <div className="text-xs text-primary mt-0.5">{rec.reasons.slice(0, 3).join(' · ')}</div>
                  </div>
                  <Button size="sm" variant={form.plan_id === rec.plan_id ? 'default' : 'outline'} onClick={() => applyAiPlan(rec)} className="text-xs">
                    {form.plan_id === rec.plan_id ? 'Applied' : 'Apply'}
                  </Button>
                </div>
              ))}
            </div>
            {aiRecs.discount_suggestion && (
              <div className="text-xs bg-orange-50 text-orange-700 p-2 rounded-lg border border-orange-200">
                💡 {aiRecs.discount_suggestion.reason}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Service Point */}
      {filteredSPs.length > 0 && (
        <div className="space-y-1.5">
          <Label>Service Point</Label>
          <Select value={form.service_point_id} onValueChange={v => set('service_point_id', v)}>
            <SelectTrigger><SelectValue placeholder="Link to service point..." /></SelectTrigger>
            <SelectContent>
              {filteredSPs.map(sp => <SelectItem key={sp.id} value={sp.id}>{sp.name} — {sp.address}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Contract Terms */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Billing Model</Label>
          <Select value={form.billing_model} onValueChange={v => set('billing_model', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="prepaid">Prepaid</SelectItem>
              <SelectItem value="postpaid">Postpaid</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Payment Method</Label>
          <Select value={form.payment_method} onValueChange={v => set('payment_method', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mtn_momo">MTN MoMo</SelectItem>
              <SelectItem value="airtel_money">Airtel Money</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Start Date</Label>
          <Input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Contract Duration (months)</Label>
          <Select value={String(form.contract_duration_months)} onValueChange={v => set('contract_duration_months', parseInt(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[1,3,6,12,24,36].map(m => <SelectItem key={m} value={String(m)}>{m} month{m>1?'s':''}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>End Date</Label>
          <Input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Service Frequency</Label>
          <Select value={form.service_frequency} onValueChange={v => set('service_frequency', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="twice_weekly">Twice Weekly</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="biweekly">Biweekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Collection Days */}
      <div className="space-y-1.5">
        <Label>Collection Days</Label>
        <div className="flex flex-wrap gap-2">
          {DAYS.map(d => (
            <button
              key={d}
              type="button"
              onClick={() => toggleDay(d)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${form.collection_days.includes(d) ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:border-primary/50'}`}
            >
              {d.charAt(0).toUpperCase() + d.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>

      {/* Discounting */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Discount (%)</Label>
          <Input type="number" min={0} max={100} value={form.discount_pct} onChange={e => set('discount_pct', parseFloat(e.target.value) || 0)} />
        </div>
        <div className="space-y-1.5">
          <Label>Discount Reason</Label>
          <Input value={form.discount_reason} onChange={e => set('discount_reason', e.target.value)} placeholder="e.g. churn retention" />
        </div>
      </div>

      {/* Calculated price */}
      {selectedPlan && (
        <div className="bg-secondary/50 rounded-xl p-3 text-sm">
          <div className="flex justify-between">
            <span>Base: {(selectedPlan.price_ugx||0).toLocaleString()} UGX</span>
            {form.discount_pct > 0 && <span className="text-destructive">-{form.discount_pct}%</span>}
            <span className="font-bold text-primary">
              {Math.round((selectedPlan.price_ugx || 0) * (1 - form.discount_pct / 100)).toLocaleString()} UGX/{selectedPlan.billing_cycle}
            </span>
          </div>
        </div>
      )}

      {/* Legal & Contract Details */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Early Termination Fee (UGX)</Label>
          <Input type="number" min={0} value={form.early_termination_fee_ugx} onChange={e => set('early_termination_fee_ugx', Number(e.target.value))} />
        </div>
        <div className="space-y-1.5">
          <Label>T&C Version</Label>
          <Input value={form.terms_and_conditions_version} onChange={e => set('terms_and_conditions_version', e.target.value)} placeholder="e.g. v2.1-2025" />
        </div>
      </div>

      {/* Contract Document Upload */}
      <div className="space-y-1.5">
        <Label>Contract Document</Label>
        {form.contract_document_url ? (
          <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-secondary/30 text-sm">
            <FileText className="w-4 h-4 text-primary shrink-0" />
            <a href={form.contract_document_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex-1 truncate">View document</a>
            <button onClick={() => set('contract_document_url', '')} className="text-muted-foreground hover:text-destructive">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <label className="flex items-center gap-2 p-2.5 rounded-lg border border-dashed border-border bg-muted/30 text-sm text-muted-foreground cursor-pointer hover:bg-muted/50 transition-colors">
            <Upload className="w-4 h-4" />
            {uploading ? 'Uploading...' : 'Upload PDF / contract document'}
            <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleFileUpload} disabled={uploading} />
          </label>
        )}
      </div>

      {/* Contract signature */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Switch id="autoRenew" checked={form.auto_renew} onCheckedChange={v => set('auto_renew', v)} />
          <Label htmlFor="autoRenew" className="text-sm">Auto-renew</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="signed" checked={form.contract_signed} onCheckedChange={v => { set('contract_signed', v); if (v) set('contract_signed_date', format(new Date(), 'yyyy-MM-dd')); }} />
          <Label htmlFor="signed" className="text-sm">Contract signed</Label>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Notes</Label>
        <Textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
        <Button onClick={handleSave} disabled={!form.customer_id || !form.plan_id} className="flex-1">
          {subscription ? 'Update Contract' : 'Create Contract'}
        </Button>
      </div>
    </div>
  );
}