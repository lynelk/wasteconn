import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Gift, Share2, Copy, Check } from 'lucide-react';

export default function ReferralCard({ customer, t = (k) => k }) {
  const [copied, setCopied] = useState(false);

  const { data: code } = useQuery({
    queryKey: ['referral-code', customer?.id],
    queryFn: () => base44.functions.invoke('processReferral', { action: 'get_or_create_code', customer_id: customer.id }),
    enabled: !!customer?.id,
    select: (res) => (res?.data || res)?.code,
  });

  const { data: referrals = [] } = useQuery({
    queryKey: ['my-referrals', customer?.id],
    queryFn: () => base44.entities.Referral.filter({ referrer_customer_id: customer.id }),
    enabled: !!customer?.id,
  });

  const rewardedCount = referrals.filter(r => r.status === 'rewarded').length;

  const handleShare = async () => {
    const shareText = `Join NLSWMS waste collection and use my referral code ${code} — we both earn a reward!`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'NLSWMS Referral', text: shareText });
        return;
      } catch { /* user cancelled — fall through to copy */ }
    }
    try {
      await navigator.clipboard.writeText(code || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  };

  if (!customer) return null;

  return (
    <Card className="mb-4 border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Gift className="w-4 h-4 text-primary" /> {t('referral.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{t('referral.description')}</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-muted rounded-lg px-3 py-2">
            <p className="text-[10px] text-muted-foreground uppercase">{t('referral.yourCode')}</p>
            <p className="text-sm font-mono font-bold tracking-wider">{code || '—'}</p>
          </div>
          <Button size="sm" onClick={handleShare} disabled={!code} className="gap-1.5 h-auto py-2">
            {copied ? <Check className="w-3.5 h-3.5" /> : navigator.share ? <Share2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {t('referral.share')}
          </Button>
        </div>
        {referrals.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {referrals.length} referral{referrals.length > 1 ? 's' : ''} · {rewardedCount} rewarded
          </p>
        )}
      </CardContent>
    </Card>
  );
}
