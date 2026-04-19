import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Smartphone, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export default function YoPaymentPanel({ onPaymentCreated }) {
  const [customerId, setCustomerId] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [narration, setNarration] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const handleCustomerChange = (id) => {
    setCustomerId(id);
    const customer = customers.find(c => c.id === id);
    if (customer?.mobile_money_number) setPhone(customer.mobile_money_number);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    const response = await base44.functions.invoke('initiateYoPayment', {
      customer_id: customerId,
      phone_number: phone,
      amount: parseFloat(amount),
      narration: narration || 'Waste collection payment',
    });
    setResult(response.data);
    setLoading(false);
    if (response.data?.success && onPaymentCreated) onPaymentCreated();
  };

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle className="font-jakarta flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-primary" /> Yo! Payments Collection
        </CardTitle>
        <CardDescription>Initiate a mobile money collection request via Yo! Payments</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Customer</Label>
            <Select value={customerId} onValueChange={handleCustomerChange}>
              <SelectTrigger><SelectValue placeholder="Select customer..." /></SelectTrigger>
              <SelectContent>
                {customers.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Mobile Money Number</Label>
            <Input placeholder="e.g. 0772123456" value={phone} onChange={e => setPhone(e.target.value)} required />
          </div>

          <div className="space-y-1.5">
            <Label>Amount (UGX)</Label>
            <Input type="number" placeholder="e.g. 50000" value={amount} onChange={e => setAmount(e.target.value)} required min="1" />
          </div>

          <div className="space-y-1.5">
            <Label>Narration</Label>
            <Input placeholder="Waste collection payment" value={narration} onChange={e => setNarration(e.target.value)} />
          </div>

          {result && (
            <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              {result.success ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
              <span>{result.message || (result.success ? 'Payment request sent successfully.' : 'Payment request failed.')}</span>
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
            {loading ? 'Sending Request...' : 'Send Collection Request'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}