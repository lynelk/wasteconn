import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import EntitySelect from '@/components/common/EntitySelect';
import { FileText, Download, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function CustomerStatementModal({ open, onClose }) {
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!customerId) { setError('Please select a customer.'); return; }
    setError('');
    setLoading(true);
    try {
      // The statement is a binary PDF, so fetch the function endpoint directly
      // for the blob (the SDK's invoke() assumes a JSON response).
      const token = base44.auth._token || '';
      const res = await fetch(`/api/functions/generateCustomerStatement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ customer_id: customerId, date_from: dateFrom || undefined, date_to: dateTo || undefined }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to generate statement');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const filename = `statement_${customerName?.replace(/\s+/g,'_') || customerId}.pdf`;
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-jakarta flex items-center gap-2">
            <FileText className="w-4 h-4" /> Generate Customer Statement
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-sm">Customer *</Label>
            <EntitySelect
              entity="Customer"
              value={customerId}
              onChange={(id, row) => { setCustomerId(id); setCustomerName(row?.full_name || ''); }}
              searchFields={['full_name', 'account_number', 'phone']}
              getLabel={(r) => `${r.full_name}${r.account_number ? ` · ${r.account_number}` : ''}`}
              placeholder="Select customer..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">From Date</Label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">To Date</Label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Leave dates empty to include all records.</p>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button onClick={handleGenerate} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {loading ? 'Generating...' : 'Download PDF'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}