import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, MessageSquare, ThumbsUp, ThumbsDown, Minus } from 'lucide-react';
import { format } from 'date-fns';

function StarRating({ rating }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={`w-4 h-4 ${i <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`}
        />
      ))}
    </div>
  );
}

function SentimentBadge({ sentiment }) {
  if (!sentiment) return null;
  const config = {
    positive: { icon: ThumbsUp, className: 'bg-green-100 text-green-700', label: 'Positive' },
    neutral:  { icon: Minus,     className: 'bg-gray-100 text-gray-600',   label: 'Neutral' },
    negative: { icon: ThumbsDown,className: 'bg-red-100 text-red-700',     label: 'Negative' },
  }[sentiment] || { icon: Minus, className: 'bg-gray-100 text-gray-600', label: sentiment };
  const Icon = config.icon;
  return (
    <Badge className={`text-[10px] gap-1 ${config.className}`} variant="secondary">
      <Icon className="w-3 h-3" /> {config.label}
    </Badge>
  );
}

export default function PickupFeedback({ pickupId }) {
  const { data: satisfaction = [], isLoading } = useQuery({
    queryKey: ['pickup-satisfaction', pickupId],
    queryFn: () => base44.entities.CustomerSatisfaction.filter({ pickup_request_id: pickupId }),
    enabled: !!pickupId,
  });

  if (isLoading) return (
    <Card className="border-border/60">
      <CardContent className="pt-5 pb-4">
        <div className="h-16 bg-muted rounded-lg animate-pulse" />
      </CardContent>
    </Card>
  );

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold font-jakarta flex items-center gap-2">
          <Star className="w-4 h-4 text-yellow-400" /> Customer Satisfaction
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {satisfaction.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
            <MessageSquare className="w-4 h-4 opacity-40" />
            <span>No feedback received for this pickup yet.</span>
          </div>
        ) : (
          <div className="space-y-4">
            {satisfaction.map(s => (
              <div key={s.id} className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <StarRating rating={s.rating} />
                  <div className="flex items-center gap-2">
                    {s.ai_sentiment && <SentimentBadge sentiment={s.ai_sentiment} />}
                    {s.responded_at && (
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(s.responded_at), 'MMM d, yyyy')}
                      </span>
                    )}
                  </div>
                </div>

                {s.comment && (
                  <blockquote className="border-l-2 border-primary/30 pl-3 text-sm text-muted-foreground italic">
                    "{s.comment}"
                  </blockquote>
                )}

                {s.ai_pain_points?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {s.ai_pain_points.map((p, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px] bg-red-50 text-red-700">{p}</Badge>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="capitalize">via {s.channel || 'in_app'}</span>
                  {s.rating >= 4 && <span className="text-green-600 font-medium">· Good experience</span>}
                  {s.rating <= 2 && <span className="text-red-600 font-medium">· Needs follow-up</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}