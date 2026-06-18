import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import {
  CreditCard, RefreshCw, Play, CheckCircle,
  ChevronDown, ChevronUp, FileText, Send, TrendingDown, Plus
} from 'lucide-react';
import AdHocInvoiceModal from '@/components/billing/AdHocInvoiceModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import ArrearsAgingTable from '@/components/billing/ArrearsAgingTable';
import CollectionsRiskPanel from '@/components/billing/CollectionsRiskPanel';

const statusColors = {
  issued: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  partially_paid: 'bg-yellow-100 text-yellow-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-600',
};

export default function BillingPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [showAdHoc, setShowAdHoc] = useState(false);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list('-created_date', 200),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: stats } = useQuery({
    queryKey: ['billing-stats'],
    queryFn: async () => {
      const res = await base44.functions.invoke('billingSummary', {});
      return res.data?.data || {};
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Invoice.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['billing-stats'] });
    },
  });

  const handleGenerateInvoices = async () => {
    setGenerating(true);
    try {
      const res = await base44.functions.invoke('generateMonthlyInvoices', { month: selectedMonth });
      toast({
        title: 'Invoices Generated',
        description: `${res.data?.count || 0} invoices created for ${selectedMonth}.`,
      });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['billing-stats'] });
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handleSendReminders = async () => {
    setSendingReminders(true);
    try {
      const res = await base44.functions.invoke('sendPaymentReminders', {});
      toast({ title: 'Reminders Sent', description: `${res.data?.sent || 0} payment reminders dispatched.` });
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSendingReminders(false);
    }
  };

  const handleMarkPaid = (invoice) => {
    updateMutation.mutate({ id: invoice.id, data: { status: 'paid', paid_date: new Date().toISOString() } });
    toast({ title: 'Marked as Paid', description: `Invoice ${invoice.invoice_number} updated.` });
  };

  const filtered = statusFilter === 'all' ? invoices : invoices.filter(i => i.status === statusFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-jakarta flex items-center gap-2"><CreditCard className="w-6 h-6" /> Billing & Invoices</h1>
          <p className="text-muted-foreground text-sm mt-1">Automated monthly billing with QuickBooks sync support</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input
            type="month"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="border border-input bg-background rounded-lg px-3 py-2 text-sm"
          />
          <Button variant="outline" onClick={handleSendReminders} disabled={sendingReminders} className="gap-2">
            {sendingReminders ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send Reminders
          </Button>
          <Button variant="outline" onClick={() => setShowAdHoc(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Ad-hoc Invoice
          </Button>
          <Button onClick={handleGenerateInvoices} disabled={generating} className="gap-2">
            {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Generate Invoices
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Pending', value: stats?.total_issued || 0, color: 'text-blue-600' },
          { label: 'Paid', value: stats?.total_paid || 0, color: 'text-green-600' },
          { label: 'Overdue', value: stats?.total_overdue || 0, color: 'text-red-600' },
          { label: 'Revenue', value: `${((stats?.revenue_ugx || 0) / 1000000).toFixed(1)}M`, color: 'text-primary', sub: 'UGX' },
          { label: 'Outstanding', value: `${((stats?.outstanding_ugx || 0) / 1000000).toFixed(1)}M`, color: 'text-orange-600', sub: 'UGX' },
        ].map(s => (
          <Card key={s.label} className="border-border/60">
            <CardContent className="pt-4 pb-4">
              <div className={`text-2xl font-bold font-jakarta ${s.color}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label} {s.sub || ''}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* QuickBooks Banner */}
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-800 dark:text-blue-200">QuickBooks Integration</span>
          <Badge variant="outline" className="text-xs border-blue-300 text-blue-600">Provisioned</Badge>
        </div>
        <span className="text-xs text-blue-600 dark:text-blue-400">Configure in System Settings when ready to connect</span>
      </div>

      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices" className="gap-1.5"><CreditCard className="w-3.5 h-3.5" /> Invoices</TabsTrigger>
          <TabsTrigger value="arrears" className="gap-1.5"><TrendingDown className="w-3.5 h-3.5" /> Arrears Aging</TabsTrigger>
          <TabsTrigger value="risk" className="gap-1.5"><FileText className="w-3.5 h-3.5" /> Collections AI</TabsTrigger>
          <TabsTrigger value="efris" className="gap-1.5"><FileText className="w-3.5 h-3.5" /> EFRIS Tax</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="mt-4 space-y-4">
          {/* Filter */}
          <div className="flex items-center gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="issued">Issued</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="partially_paid">Partially Paid</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No invoices found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(inv => (
                <Card key={inv.id} className="border-border/60">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm font-jakarta">{inv.invoice_number}</span>
                          <Badge className={`text-xs ${statusColors[inv.status] || ''}`} variant="secondary">
                            {inv.status?.replace('_', ' ')}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Issued: {inv.issue_date} · Due: {inv.due_date}
                          {inv.paid_date && ` · Paid: ${format(new Date(inv.paid_date), 'MMM d, yyyy')}`}
                        </div>
                        <div className="text-base font-bold text-primary mt-1">
                          {(inv.amount_ugx || 0).toLocaleString()} UGX
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {inv.status === 'issued' && (
                          <Button size="sm" variant="outline" onClick={() => handleMarkPaid(inv)} className="gap-1 text-xs h-7">
                            <CheckCircle className="w-3 h-3" /> Mark Paid
                          </Button>
                        )}
                        <button onClick={() => setExpandedId(expandedId === inv.id ? null : inv.id)} className="text-muted-foreground hover:text-foreground">
                          {expandedId === inv.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    {expandedId === inv.id && inv.items?.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/60">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-muted-foreground">
                              <th className="text-left pb-1">Description</th>
                              <th className="text-right pb-1">Qty</th>
                              <th className="text-right pb-1">Unit</th>
                              <th className="text-right pb-1">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {inv.items.map((item, i) => (
                              <tr key={i}>
                                <td className="py-0.5">{item.description}</td>
                                <td className="text-right py-0.5">{item.quantity}</td>
                                <td className="text-right py-0.5">{(item.unit_price_ugx||0).toLocaleString()}</td>
                                <td className="text-right py-0.5 font-medium">{(item.total_ugx||0).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {inv.notes && <p className="text-xs text-muted-foreground mt-2 italic">{inv.notes}</p>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="arrears" className="mt-4">
          <ArrearsAgingTable invoices={invoices} customers={customers} />
        </TabsContent>

        <TabsContent value="risk" className="mt-4">
          <CollectionsRiskPanel />
        </TabsContent>
        <TabsContent value="efris" className="mt-4">
          <div className="text-center py-8">
            <FileText className="w-12 h-12 mx-auto mb-3 text-primary" />
            <h3 className="text-lg font-semibold mb-2">EFRIS Tax Compliance Module</h3>
            <p className="text-muted-foreground mb-4">
              Manage URA EFRIS invoice generation, reconciliation, and tax reporting
            </p>
            <Button onClick={() => window.location.href = '/efris'} className="gap-2">
              Open EFRIS Dashboard
              <ChevronDown className="w-4 h-4" />
            </Button>
          </div>
        </TabsContent>
      </Tabs>
      {showAdHoc && (
        <AdHocInvoiceModal
          open={showAdHoc}
          onClose={() => setShowAdHoc(false)}
          customers={customers}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['invoices'] }); qc.invalidateQueries({ queryKey: ['billing-stats'] }); }}
        />
      )}
    </div>
  );
}