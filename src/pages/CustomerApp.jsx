import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/ui/PullToRefreshIndicator';
import { FileText, Plus, LogOut, Download, Truck, MapPin, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CustomerPickupModal from '@/components/customer/CustomerPickupModal';
import CustomerInvoiceCard from '@/components/customer/CustomerInvoiceCard';
import SurveyModal from '@/components/customer/SurveyModal';
import TrackDispatchModal from '@/components/customer/TrackDispatchModal';
import SupportChatWidget from '@/components/customer/SupportChatWidget';
import CustomerStatementModal from '@/components/payments/CustomerStatementModal';
import ImpactCard from '@/components/customer/ImpactCard';
import ReferralCard from '@/components/customer/ReferralCard';
import { useTranslation, LANGUAGES } from '@/lib/i18n';
import { Star, Award } from 'lucide-react';

const statusColor = {
  pending: 'bg-yellow-100 text-yellow-700',
  assigned: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function CustomerApp() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [activeTab, setActiveTab] = useState('history');
  const [activeSurvey, setActiveSurvey] = useState(null);
  const [trackingPickup, setTrackingPickup] = useState(null);
  const [statementOpen, setStatementOpen] = useState(false);

  const { data: customer } = useQuery({
    queryKey: ['my-customer', user?.email],
    queryFn: () => base44.entities.Customer.filter({ email: user?.email }),
    select: data => data?.[0],
    enabled: !!user?.email,
  });

  const { data: pickups = [], isLoading: loadingPickups } = useQuery({
    queryKey: ['my-pickups', customer?.id],
    queryFn: () => base44.entities.PickupRequest.filter({ customer_id: customer?.id }),
    enabled: !!customer?.id,
  });

  const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ['my-invoices', customer?.id],
    queryFn: () => base44.entities.Invoice.filter({ customer_id: customer?.id }),
    enabled: !!customer?.id,
  });

  const { data: pendingSurveys = [], refetch: refetchSurveys } = useQuery({
    queryKey: ['my-surveys', customer?.id],
    queryFn: () => base44.entities.CustomerSatisfaction.filter({ customer_id: customer?.id }),
    select: data => data?.filter(s => s.rating == null) || [],
    enabled: !!customer?.id,
  });

  const { data: servicePoints = [] } = useQuery({
    queryKey: ['my-service-points', customer?.id],
    queryFn: () => base44.entities.ServicePoint.filter({ customer_id: customer?.id }),
    enabled: !!customer?.id,
  });

  const { data: myPayments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ['my-payments', customer?.id],
    queryFn: () => base44.entities.Payment.filter({ customer_id: customer?.id }),
    enabled: !!customer?.id,
  });

  const { data: loyalty } = useQuery({
    queryKey: ['my-loyalty', customer?.id],
    queryFn: () => base44.entities.LoyaltyAccount.filter({ customer_id: customer?.id }),
    select: data => data?.[0] || null,
    enabled: !!customer?.id,
  });

  const { t, lang, setLang } = useTranslation(customer);

  const requestPickupMutation = useMutation({
    mutationFn: (data) => base44.entities.PickupRequest.create({
      ...data,
      customer_id: customer.id,
      tenant_id: customer.tenant_id,
      request_type: 'on_demand',
      status: 'pending',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-pickups'] });
      setShowPickupModal(false);
    },
  });

  const tabs = [
    { key: 'history', label: t('tabs.history'), icon: Truck },
    { key: 'invoices', label: t('tabs.invoices'), icon: FileText },
    { key: 'payments', label: t('tabs.payments'), icon: CreditCard },
  ];

  const TIER_BADGE = {
    bronze: 'bg-amber-200/30 text-amber-100',
    silver: 'bg-slate-200/30 text-slate-100',
    gold: 'bg-yellow-200/30 text-yellow-100',
    platinum: 'bg-cyan-200/30 text-cyan-100',
  };

  const handleRefresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['my-pickups'] }),
      queryClient.invalidateQueries({ queryKey: ['my-invoices'] }),
      queryClient.invalidateQueries({ queryKey: ['my-service-points'] }),
      queryClient.invalidateQueries({ queryKey: ['my-payments'] }),
    ]);
  };

  const paymentStatusColor = {
    pending: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    refunded: 'bg-gray-100 text-gray-600',
    expired: 'bg-gray-100 text-gray-500',
    under_review: 'bg-orange-100 text-orange-700',
  };
  const methodLabel = { mtn_momo: 'MTN MoMo', airtel_money: 'Airtel', cash: 'Cash', bank_transfer: 'Bank', yo_payments: 'Yo! Payments' };
  const totalPaid = myPayments.filter(p => p.status === 'completed').reduce((s, p) => s + (p.amount_ugx || 0), 0);

  const { pulling, pullDistance, refreshing } = usePullToRefresh({ onRefresh: handleRefresh });

  const recentPickups = [...pickups].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  const completedCount = pickups.filter(p => p.status === 'completed').length;
  const pendingCount = pickups.filter(p => ['pending', 'assigned', 'in_progress'].includes(p.status)).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Pull-to-refresh indicator */}
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />

      {/* Header */}
      <div className="bg-primary text-white px-4 pt-6 pb-8">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold font-jakarta">
                {user?.full_name?.[0] || 'C'}
              </div>
              <div>
                <p className="font-semibold font-jakarta flex items-center gap-2">
                  {user?.full_name || 'Customer'}
                  {loyalty?.tier && (
                    <span className={`flex items-center gap-1 text-[10px] font-semibold capitalize rounded-full px-2 py-0.5 ${TIER_BADGE[loyalty.tier] || 'bg-white/20'}`}>
                      <Award className="w-3 h-3" /> {loyalty.tier}
                    </span>
                  )}
                </p>
                <p className="text-xs text-white/70">{customer?.account_number ? `${t('header.account')}: ${customer.account_number}` : t('header.portal')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="bg-white/10 text-white text-xs rounded-lg px-2 py-1 border border-white/20 focus:outline-none"
                aria-label="Language"
              >
                {LANGUAGES.map(l => (
                  <option key={l.code} value={l.code} className="text-foreground">{l.label}</option>
                ))}
              </select>
              <button onClick={() => base44.auth.logout('/')} className="text-white/70 hover:text-white">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <div className="text-xl font-bold font-jakarta">{completedCount}</div>
              <div className="text-xs text-white/70">{t('stats.pickups')}</div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <div className="text-xl font-bold font-jakarta">{pendingCount}</div>
              <div className="text-xs text-white/70">{t('stats.pending')}</div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <div className="text-xl font-bold font-jakarta">{invoices.filter(i => i.status === 'issued' || i.status === 'overdue').length}</div>
              <div className="text-xs text-white/70">{t('stats.dueInvoices')}</div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <div className="text-xl font-bold font-jakarta">{myPayments.filter(p => p.status === 'completed').length}</div>
              <div className="text-xs text-white/70">{t('stats.paid')}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4">
        {/* Pending Survey Banner */}
        {pendingSurveys.length > 0 && (
          <button
            onClick={() => setActiveSurvey(pendingSurveys[0])}
            className="w-full mb-3 flex items-center gap-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-300 rounded-xl px-4 py-3 text-left hover:bg-yellow-100 transition-colors"
          >
            <Star className="w-5 h-5 text-yellow-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">{t('survey.rate')}</p>
              <p className="text-xs text-yellow-600 dark:text-yellow-400">{pendingSurveys.length} {t('survey.awaiting')}</p>
            </div>
          </button>
        )}

        {/* Request Pickup CTA */}
        <Button
          onClick={() => setShowPickupModal(true)}
          className="w-full mb-4 shadow-lg bg-white text-primary hover:bg-gray-50 border border-primary/20 font-semibold"
          disabled={!customer}
        >
          <Plus className="w-4 h-4" /> {t('cta.requestPickup')}
        </Button>

        {/* Environmental impact + loyalty */}
        <ImpactCard pickups={pickups} loyalty={loyalty} t={t} />

        {/* Referral program */}
        <ReferralCard customer={customer} t={t} />

        {/* Service Points */}
        {servicePoints.length > 0 && (
          <Card className="mb-4 border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" /> {t('servicePoints.title')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {servicePoints.map(sp => (
                  <div key={sp.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{sp.address}</span>
                    <Badge variant="secondary" className="text-xs capitalize">{sp.status}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <div className="flex bg-muted rounded-xl p-1 mb-4">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === tab.key ? 'bg-white shadow text-foreground' : 'text-muted-foreground'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" /> {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === 'history' && (
          <div className="space-y-3 pb-8">
            {loadingPickups ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
              </div>
            ) : recentPickups.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Truck className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">{t('history.empty')}</p>
              </div>
            ) : (
              recentPickups.map(pickup => (
                <Card key={pickup.id} className="border-border/60">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium capitalize">{pickup.waste_type} waste · {pickup.request_type?.replace('_', ' ')}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{pickup.address || 'Address on file'}</p>
                        {pickup.scheduled_date && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            📅 {format(new Date(pickup.scheduled_date), 'MMM d, yyyy')}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge className={`text-xs ${statusColor[pickup.status] || ''}`} variant="secondary">
                          {pickup.status?.replace('_', ' ')}
                        </Badge>
                        {(pickup.status === 'assigned' || pickup.status === 'in_progress') && pickup.assigned_driver_id && (
                          <button
                            onClick={() => setTrackingPickup(pickup)}
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            <MapPin className="w-3 h-3" /> {t('history.trackDriver')}
                          </button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {activeTab === 'invoices' && (
          <div className="space-y-3 pb-8">
            {loadingInvoices ? (
              <div className="space-y-3">
                {[1,2].map(i => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}
              </div>
            ) : invoices.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">{t('invoices.empty')}</p>
              </div>
            ) : (
              invoices.map(invoice => (
                <CustomerInvoiceCard key={invoice.id} invoice={invoice} customer={customer} />
              ))
            )}
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="space-y-3 pb-8">
            {/* Summary */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{t('payments.totalPaid')}</p>
                <p className="text-lg font-bold font-jakarta text-primary">{totalPaid.toLocaleString()} UGX</p>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setStatementOpen(true)}>
                <Download className="w-3.5 h-3.5" /> {t('payments.statement')}
              </Button>
            </div>

            {loadingPayments ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}
              </div>
            ) : myPayments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">{t('payments.empty')}</p>
              </div>
            ) : (
              [...myPayments]
                .sort((a, b) => new Date(b.payment_date || b.created_date) - new Date(a.payment_date || a.created_date))
                .map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-card">
                    <div>
                      <p className="text-sm font-semibold">{(p.amount_ugx || 0).toLocaleString()} UGX</p>
                      <p className="text-xs text-muted-foreground">
                        {methodLabel[p.payment_method] || p.payment_method || '—'}
                        {p.payment_date ? ` · ${format(new Date(p.payment_date), 'MMM d, yyyy')}` : ''}
                      </p>
                      {p.transaction_ref && <p className="text-[10px] text-muted-foreground font-mono">Ref: {p.transaction_ref}</p>}
                    </div>
                    <Badge className={`text-xs ${paymentStatusColor[p.status] || 'bg-muted text-muted-foreground'}`} variant="secondary">
                      {p.status?.replace('_', ' ')}
                    </Badge>
                  </div>
                ))
            )}
          </div>
        )}
      </div>

      {/* Survey Modal */}
      {activeSurvey && (
        <SurveyModal
          survey={activeSurvey}
          onClose={() => setActiveSurvey(null)}
          onSubmitted={() => { setActiveSurvey(null); refetchSurveys(); }}
        />
      )}

      {/* Track Dispatch Modal */}
      {trackingPickup && (
        <TrackDispatchModal pickup={trackingPickup} onClose={() => setTrackingPickup(null)} />
      )}

      {/* Customer Statement Download */}
      <CustomerStatementModal
        open={statementOpen}
        onClose={() => setStatementOpen(false)}
        customers={customer ? [customer] : []}
      />

      {/* AI Support Chat */}
      <SupportChatWidget customer={customer} />

      {/* Pickup Modal */}
      {showPickupModal && (
        <CustomerPickupModal
          servicePoints={servicePoints}
          customer={customer}
          onSubmit={(data) => requestPickupMutation.mutate(data)}
          onClose={() => setShowPickupModal(false)}
          isLoading={requestPickupMutation.isPending}
        />
      )}
    </div>
  );
}