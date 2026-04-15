import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

export default function PullToRefreshIndicator({ pullDistance, refreshing, threshold = 72 }) {
  const progress = Math.min(pullDistance / threshold, 1);
  const show = pullDistance > 0 || refreshing;

  if (!show) return null;

  return (
    <div
      className="flex items-center justify-center pointer-events-none"
      style={{ height: refreshing ? 48 : pullDistance, transition: refreshing ? 'height 0.2s ease' : 'none', overflow: 'hidden' }}
    >
      <motion.div
        animate={{ rotate: refreshing ? 360 : progress * 270 }}
        transition={refreshing ? { repeat: Infinity, duration: 0.7, ease: 'linear' } : { duration: 0 }}
        className={`w-7 h-7 rounded-full flex items-center justify-center ${progress >= 1 || refreshing ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
        style={{ opacity: Math.max(progress, refreshing ? 1 : 0) }}
      >
        <RefreshCw className="w-4 h-4" />
      </motion.div>
    </div>
  );
}