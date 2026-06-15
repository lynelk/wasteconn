import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Trash2, Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import MobileSelect from '@/components/ui/MobileSelect';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';

export default function AdHocInvoiceModal({ open, onClose, customers, onSaved }) {
  const { toast } = useToast();
  const [customerId, setCustomerId] = useState('');
  const [lineItems, setLineItems] = useState([{ description: '', amount_ugx: '', quantity: 1 }]);
  const [dueDays, setDueDays] = useState(14);
  const [notes, setNotes] = useState('');
  const [sendNotif, setSendNotif] = useState(true);
  const [loading, setLoading] = useState(false);

  const addLine = () => setLineItems(l => [...l, { description: '', amount_ugx: '', quantity: 1 }]);
  const removeLine = i => setLineItems(l => l.filter((_, idx) => idx !== i));
  const updateLine = (i, k, v) => setLineItems(l => l.map((item, idx) => idx === i ? { ...item, [k]: v } : item));

  const total = lineItems.reduce((s, l) => s + (parseFloat(l.amount_ugx) || 0) * (parseInt(l.quantity) || 1), 0);

  const handleSubmit = async () => {
    if (!customerId || lineItems.some(l => !l.description || !l.amount_ugx)) {
      toast({ title: 'Fill all required fields', variant: 'destructive' }); return;
    }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('generateAdHocInvoice', {
        customer_id: customerId,
        line_items: lineItems.map(l => ({ description: l.description, amount_ugx: parseFloat(l.amount_ugx), quantity: parseInt(l.quantity) || 1 })),
        due_days: dueDays,
        notes,
        send_notification: sendNotif,
      });
      toast({ title: `Invoice ${res.data.invoice_number} created — ${res.data.amount_ugx.toLocaleString()} UGX` });
      onSaved?.();
      onClose();
    } catch (err) {
      toast({ title: 'Failed to create invoice', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-jakarta flex items-center gap-2"><FileText className="w-5 h-5" /> Ad-hoc Invoice</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label>Customer *</Label>
            <MobileSelect
              value={customerId}
              onChange={setCustomerId}
              placeholder="Select customer..."
              options={customers.map(c => ({ value: c.id, label: `${c.full_name} — ${c.phone}` }))}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Line Items *</Label>
              <Button variant="ghost" size="sm" onClick={addLine} className="gap-1 h-7 text-xs"><Plus className="w-3 h-3" /> Add Line</Button>
            </div>
            {lineItems.map((line, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <Input className="col-span-5" placeholder="Description" value={line.description} onChange={e => updateLine(i, 'description', e.target.value)} />
                <Input className="col-span-3" type="number" placeholder="Amount UGX" value={line.amount_ugx} onChange={e => updateLine(i, 'amount_ugx', e.target.value)} />
                <Input className="col-span-2" type="number" min={1} placeholder="Qty" value={line.quantity} onChange={e => updateLine(i, 'quantity', e.target.value)} />
                <button onClick={() => removeLine(i)} className="col-span-2 text-muted-foreground hover:text-destructive flex justify-center">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <div className="text-right text-sm font-semibold text-primary">Total: {total.toLocaleString()} UGX</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Due in (days)</Label>
              <MobileSelect
                value={String(dueDays)}
                onChange={v => setDueDays(parseInt(v))}
                options={[7, 14, 30, 60].map(d => ({ value: String(d), label: `${d} days` }))}
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch id="notif" checked={sendNotif} onCheckedChange={setSendNotif} />
              <Label htmlFor="notif" className="text-sm">Notify customer</Label>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Bulky item removal — March 2026" />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={handleSubmit} disabled={loading || !customerId} className="flex-1 gap-2">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : 'Create Invoice'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}