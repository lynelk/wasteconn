import { Badge } from '@/components/ui/badge';

const statusToVariant = {
  active: 'default',
  completed: 'default',
  success: 'default',
  pending: 'secondary',
  paused: 'secondary',
  failed: 'destructive',
  cancelled: 'destructive'
};

export default function StatusBadge({ status }) {
  const normalized = String(status || 'unknown').toLowerCase();
  return <Badge variant={statusToVariant[normalized] || 'outline'}>{normalized}</Badge>;
}
