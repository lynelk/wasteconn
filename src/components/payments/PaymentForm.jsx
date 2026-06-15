import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import MobileSelect from '@/components/ui/MobileSelect';
import { Textarea } from '@/components/ui/textarea';
import EntitySelect from '@/components/common/EntitySelect';

export default function PaymentForm({ onClose }) {
  const qc = useQueryClient();

  const [form, setForm] = useState({
    customer_id: '',
    tenant_id: '',
    amount_ugx: '',
    payment_method: 'cash',
    status: 'completed',
    transaction_ref: '',
    mobile_money_number: '',
    payment_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCustomerChange = (id, c) => {
    setForm(f => ({ ...f, customer_id: id, tenant_id: c?.tenant_id || '', mobile_money_number: c?.mobile_money_number || f.mobile_money_number }));
  };

  const mutation = useMutation({
    mutationFn: () => base44.entities.Payment.create({ ...form, amount_ugx: Number(form.amount_ugx) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payments'] }); onClose(); },
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1.5">
          <Label>Customer *</Label>
          <EntitySelect entity="Customer" value={form.customer_id} onChange={handleCustomerChange} searchFields={['full_name', 'phone']} getLabel={(c) => `${c.full_name} — ${c.phone}`} placeholder="Select customer" />
        </div>
        <div className="space-y-1.5">
          <Label>Amount (UGX) *</Label>
          <Input type="number" value={form.amount_ugx} onChange={e => set('amount_ugx', e.target.value)} placeholder="e.g. 50000" />
        </div>
        <div className="space-y-1.5">
          <Label>Payment Date</Label>
          <Input type="date" value={form.payment_date} onChange={e => set('payment_date', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Payment Method</Label>
          <MobileSelect value={form.payment_method} onChange={v => set('payment_method', v)} options={[{value:'cash',label:'Cash'},{value:'mtn_momo',label:'MTN MoMo'},{value:'airtel_money',label:'Airtel Money'},{value:'bank_transfer',label:'Bank Transfer'},{value:'yo_payments',label:'Yo! Payments'}]} />
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <MobileSelect value={form.status} onChange={v => set('status', v)} options={[{value:'completed',label:'Completed'},{value:'pending',label:'Pending'}]} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Transaction Reference</Label>
          <Input value={form.transaction_ref} onChange={e => set('transaction_ref', e.target.value)} placeholder="Mobile money or bank ref..." />
        </div>
        {(form.payment_method === 'mtn_momo' || form.payment_method === 'airtel_money' || form.payment_method === 'yo_payments') && (
          <div className="col-span-2 space-y-1.5">
            <Label>Mobile Money Number</Label>
            <Input value={form.mobile_money_number} onChange={e => set('mobile_money_number', e.target.value)} placeholder="+256..." />
          </div>
        )}
        <div className="col-span-2 space-y-1.5">
          <Label>Notes</Label>
          <Textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.customer_id || !form.amount_ugx}>
          {mutation.isPending ? 'Saving...' : 'Record Payment'}
        </Button>
      </div>
    </div>
  );
}