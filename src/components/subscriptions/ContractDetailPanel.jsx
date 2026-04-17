import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format, differenceInDays, parseISO } from 'date-fns';
import {
  FileText, Calendar, User, ShieldCheck, AlertTriangle,
  RotateCcw, Ban, CheckCircle2, Clock, Edit2, ExternalLink
} from 'lucide-react';

const statusColor = {
  active: 'bg-green-100 text-green-700',
  suspended: 'bg-orange-100 text-orange-700',
  cancelled: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
  expired: 'bg-gray-100 text-gray-500',
};

export default function ContractDetailPanel({ subscription, customer, plan, onEdit, onStatusChange, onClose }) {
  if (!subscription) return null;

  const daysRemaining = subscription.end_date
    ? differenceInDays(parseISO(subscription.end_date), new Date())
    : null;

  const isExpiringSoon = daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 30;
  const isExpired = daysRemaining !== null && daysRemaining < 0;
  const discountedAmount = Math.round((plan?.price_ugx || 0) * (1 - (subscription.discount_pct || 0) / 100));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-bold text-lg font-jakarta">{customer?.institution_name || customer?.full_name}</h3>
          <p className="text-sm text-muted-foreground">{customer?.email || customer?.phone}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={`${statusColor[subscription.status]} text-xs`} variant="secondary">
            {subscription.status}
          </Badge>
          {subscription.contract_signed && (
            <Badge className="bg-green-100 text-green-700 text-xs" variant="secondary">
              <ShieldCheck className="w-3 h-3 mr-1" />Signed
            </Badge>
          )}
        </div>
      </div>

      {/* Expiry warning */}
      {isExpiringSoon && (
        <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Contract expires in <strong>{daysRemaining} days</strong>{subscription.auto_renew ? ' — will auto-renew' : ' — renewal required'}</span>
        </div>
      )}
      {isExpired && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          <Ban className="w-4 h-4 shrink-0" />
          <span>Contract has expired</span>
        </div>
      )}

      {/* Plan & Tariff */}
      <div className="bg-secondary/40 rounded-xl p-4 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tariff Plan</p>
        <div className="flex items-center justify-between">
          <span className="font-semibold text-primary">{plan?.plan_name || 'Unknown Plan'}</span>
          <span className="font-bold text-lg">{discountedAmount.toLocaleString()} UGX</span>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="capitalize">{plan?.billing_cycle || 'monthly'}</span>
          <span>·</span>
          <span className="capitalize">{subscription.service_frequency || plan?.frequency}</span>
          <span>·</span>
          <span className="capitalize">{subscription.billing_model}</span>
          {subscription.discount_pct > 0 && <span className="text-destructive">· -{subscription.discount_pct}% ({subscription.discount_reason})</span>}
        </div>
        {plan?.billing_model === 'fixed_plus_overage_kg' && (
          <p className="text-xs text-muted-foreground">
            Includes {plan.overage_threshold_kg}kg · Overage: {plan.overage_rate_ugx_per_kg?.toLocaleString()} UGX/kg
          </p>
        )}
        {plan?.setup_fee_ugx > 0 && (
          <p className="text-xs text-muted-foreground">Setup fee: {plan.setup_fee_ugx.toLocaleString()} UGX (one-time)</p>
        )}
      </div>

      {/* Contract Terms */}
      <div className="grid grid-cols-2 gap-3">
        <InfoRow icon={<Calendar className="w-3.5 h-3.5" />} label="Start" value={subscription.start_date || '—'} />
        <InfoRow icon={<Calendar className="w-3.5 h-3.5" />} label="End" value={subscription.end_date || '∞'} />
        <InfoRow icon={<Clock className="w-3.5 h-3.5" />} label="Duration" value={`${subscription.contract_duration_months || '?'}mo`} />
        <InfoRow icon={<RotateCcw className="w-3.5 h-3.5" />} label="Auto-renew" value={subscription.auto_renew ? 'Yes' : 'No'} />
        {subscription.early_termination_fee_ugx > 0 && (
          <InfoRow icon={<Ban className="w-3.5 h-3.5" />} label="Early exit fee" value={`${subscription.early_termination_fee_ugx.toLocaleString()} UGX`} />
        )}
        {subscription.contract_version > 1 && (
          <InfoRow icon={<FileText className="w-3.5 h-3.5" />} label="Version" value={`v${subscription.contract_version}`} />
        )}
        {subscription.terms_and_conditions_version && (
          <InfoRow icon={<ShieldCheck className="w-3.5 h-3.5" />} label="T&C" value={subscription.terms_and_conditions_version} />
        )}
        {subscription.payment_method && (
          <InfoRow icon={<CheckCircle2 className="w-3.5 h-3.5" />} label="Payment" value={subscription.payment_method.replace(/_/g, ' ')} />
        )}
      </div>

      {/* Collection days */}
      {subscription.collection_days?.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Collection Days</p>
          <div className="flex flex-wrap gap-1.5">
            {subscription.collection_days.map(d => (
              <span key={d} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs capitalize">{d}</span>
            ))}
          </div>
        </div>
      )}

      {/* Contract document */}
      {subscription.contract_document_url && (
        <a
          href={subscription.contract_document_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <FileText className="w-4 h-4" />
          View Contract Document
          <ExternalLink className="w-3 h-3" />
        </a>
      )}

      {/* Amendment history */}
      {subscription.amendment_history?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Amendment History</p>
          <div className="space-y-1.5">
            {subscription.amendment_history.map((a, i) => (
              <div key={i} className="flex items-start gap-2 text-xs border-l-2 border-border pl-3">
                <div>
                  <span className="font-medium">v{a.version}</span>
                  {' · '}
                  <span className="text-muted-foreground">{a.amended_at ? format(new Date(a.amended_at), 'dd MMM yyyy') : '—'}</span>
                  {' · '}
                  <span>{a.summary}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {subscription.notes && (
        <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">{subscription.notes}</p>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button variant="outline" onClick={onClose} className="flex-1">Close</Button>
        {subscription.status === 'active' && (
          <Button variant="outline" className="text-orange-600 border-orange-200 hover:bg-orange-50" onClick={() => onStatusChange('suspended')}>
            Suspend
          </Button>
        )}
        {(subscription.status === 'suspended' || subscription.status === 'pending') && (
          <Button variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => onStatusChange('active')}>
            Activate
          </Button>
        )}
        <Button onClick={onEdit} className="flex-1 gap-1">
          <Edit2 className="w-3.5 h-3.5" /> Edit Contract
        </Button>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-muted-foreground text-xs">{label}:</span>
      <span className="font-medium text-xs capitalize">{value}</span>
    </div>
  );
}