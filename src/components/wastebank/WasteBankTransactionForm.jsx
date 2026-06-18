import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, WifiOff } from 'lucide-react';
import MobileSelect from '@/components/ui/MobileSelect';
import EntitySelect from '@/components/common/EntitySelect';
import { queueWBTransaction } from '@/lib/offlineDB';

const WASTE_CATEGORIES = ['plastic','paper','glass','metal','organic','e_waste','textile','mixed'];
const GRADES = ['A','B','C','rejected'];
const PAYMENT_METHODS = ['mtn_momo','airtel_money','cash','wallet_credit'];

// Indicative rates per kg per grade per category (UGX)
const BASE_RATES = { plastic: 800, paper: 300, glass: 200, metal: 1200, organic: 150, e_waste: 2000, textile: 400, mixed: 200 };
const GRADE_MULTIPLIER = { A: 1.2, B: 1.0, C: 0.7, rejected: 0 };

export default function WasteBankTransactionForm({ transactionType, onClose, isOnline = true }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    customer_id: '', waste_category: 'plastic', grade: 'B', weight_kg: '',
    payment_method: 'mtn_momo', mobile_money_number: '', mobile_money_provider: 'mtn', notes: '',
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [fraudCheck, setFraudCheck] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const ratePerKg = (BASE_RATES[form.waste_category] || 200) * (GRADE_MULTIPLIER[form.grade] || 0);
  const grossAmount = form.weight_kg ? Math.round(ratePerKg * parseFloat(form.weight_kg)) : 0;
  const netAmount = grossAmount;

  const mutation = useMutation({
    mutationFn: async (data) => {
      const txNum = `WB-${transactionType.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

      // Fraud check: flag if weight > 500kg or amount > 5M UGX
      const fraudFlag = parseFloat(data.weight_kg) > 500 || netAmount > 5000000;

      const payload = {
        ...data,
        transaction_type: transactionType,
        transaction_number: txNum,
        weight_kg: parseFloat(data.weight_kg),
        rate_ugx_per_kg: ratePerKg,
        gross_amount_ugx: grossAmount,
        deductions_ugx: 0,
        net_amount_ugx: netAmount,
        payment_status: 'pending',
        fraud_flag: fraudFlag,
        fraud_reason: fraudFlag ? 'High weight or amount — manual review required' : '',
        ai_fraud_score: fraudFlag ? 80 : 10,
      };

      // If offline — queue to IndexedDB and return early
      if (!isOnline) {
        await queueWBTransaction(payload);
        return null;
      }

      const tx = await base44.entities.WasteBankTransaction.create(payload);

      // Apply the wallet movement through the ledger-backed function so the
      // balance is derived from an append-only ledger (concurrency-safe) and
      // idempotent per transaction.
      await base44.functions.invoke('walletAdjust', {
        customer_id: data.customer_id,
        tenant_id: data.tenant_id,
        amount_ugx: transactionType === 'payout' ? netAmount : -netAmount,
        kind: transactionType === 'payout' ? 'earn' : 'payin',
        reference: tx.id,
        note: `${transactionType} ${txNum}`,
      });

      return tx;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['waste-bank-transactions'] });
      qc.invalidateQueries({ queryKey: ['wallets'] });
      onClose();
    },
  });

  const handleAIGrade = async () => {
    if (!form.waste_category || !form.weight_kg) return;
    setAiLoading(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a waste grading expert for a circular economy waste bank in Uganda.
Category: ${form.waste_category}, Declared weight: ${form.weight_kg}kg.
Suggest a grade (A, B, C, or rejected) and a brief reason.
Return JSON: { grade: string, reason: string, fraud_risk: "low"|"medium"|"high" }`,
      response_json_schema: { type: 'object', properties: { grade: {type:'string'}, reason:{type:'string'}, fraud_risk:{type:'string'} } }
    });
    set('grade', result.grade || 'B');
    setFraudCheck(result);
    setAiLoading(false);
  };

  return (
    <div className="space-y-4">
      {!isOnline && (
        <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-700">
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          Offline mode — transaction will be queued and synced automatically.
        </div>
      )}
      <div>
        <Label className="text-xs">Customer *</Label>
        <div className="mt-1">
          <EntitySelect
            entity="Customer"
            value={form.customer_id || ''}
            onChange={(id) => set('customer_id', id)}
            searchFields={['full_name', 'phone', 'account_number']}
            getLabel={(c) => `${c.full_name}${c.phone ? ` · ${c.phone}` : ''}`}
            placeholder="Select customer"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Waste Category *</Label>
          <div className="mt-1">
            <MobileSelect value={form.waste_category} onChange={v => set('waste_category', v)} options={WASTE_CATEGORIES.map(c => ({ value: c, label: c.replace('_', ' ') }))} />
          </div>
        </div>
        <div>
          <Label className="text-xs">Weight (kg) *</Label>
          <Input type="number" className="mt-1" value={form.weight_kg} onChange={e => set('weight_kg', e.target.value)} placeholder="e.g. 12.5" />
        </div>
      </div>

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Label className="text-xs">Grade *</Label>
          <div className="mt-1">
            <MobileSelect value={form.grade} onChange={v => set('grade', v)} options={GRADES.map(g => ({ value: g, label: g }))} />
          </div>
        </div>
        <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleAIGrade} disabled={aiLoading || !form.waste_category}>
          {aiLoading ? 'Checking...' : '⚡ AI Grade'}
        </Button>
      </div>

      {fraudCheck && (
        <div className={`rounded-lg p-3 text-xs ${fraudCheck.fraud_risk === 'high' ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
          {fraudCheck.fraud_risk === 'high' && <div className="flex items-center gap-1 text-red-700 mb-1"><AlertTriangle className="w-3.5 h-3.5" /> High fraud risk detected</div>}
          <div><strong>AI Suggested Grade:</strong> {fraudCheck.grade} — {fraudCheck.reason}</div>
        </div>
      )}

      {grossAmount > 0 && (
        <div className="bg-muted/40 rounded-lg p-3 text-xs space-y-1">
          <div className="flex justify-between"><span>Rate:</span><strong>{ratePerKg.toLocaleString()} UGX/kg</strong></div>
          <div className="flex justify-between"><span>Gross:</span><strong>{grossAmount.toLocaleString()} UGX</strong></div>
          <div className="flex justify-between text-sm font-semibold"><span>Net Amount:</span><strong className={transactionType === 'payout' ? 'text-green-600' : 'text-blue-600'}>{netAmount.toLocaleString()} UGX</strong></div>
        </div>
      )}

      <div>
        <Label className="text-xs">Payment Method</Label>
        <div className="mt-1">
          <MobileSelect value={form.payment_method} onChange={v => set('payment_method', v)} options={PAYMENT_METHODS.map(p => ({ value: p, label: p.replace(/_/g, ' ') }))} />
        </div>
      </div>

      {['mtn_momo','airtel_money'].includes(form.payment_method) && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Mobile Money Number</Label>
            <Input className="mt-1" value={form.mobile_money_number} onChange={e => set('mobile_money_number', e.target.value)} placeholder="+256..." />
          </div>
          <div>
            <Label className="text-xs">Provider</Label>
            <div className="mt-1">
              <MobileSelect value={form.mobile_money_provider} onChange={v => set('mobile_money_provider', v)} options={[{value:'mtn',label:'MTN MoMo'},{value:'airtel',label:'Airtel Money'}]} />
            </div>
          </div>
        </div>
      )}

      <div>
        <Label className="text-xs">Notes</Label>
        <Textarea className="mt-1" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => mutation.mutate(form)} disabled={mutation.isPending || !form.customer_id || !form.weight_kg}>
          {mutation.isPending ? 'Processing...' : transactionType === 'payout' ? 'Record Payout' : 'Record Payin'}
        </Button>
      </div>
    </div>
  );
}