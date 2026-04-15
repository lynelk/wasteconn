import { useState, useEffect, useRef } from 'react';

/**
 * usePullToRefresh
 * Detects a downward pull gesture at the top of a scrollable container
 * and calls `onRefresh` when the threshold is met.
 */
export function usePullToRefresh({ onRefresh, threshold = 72, scrollRef }) {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);

  useEffect(() => {
    const el = scrollRef?.current || window;
    const getScrollTop = () =>
      scrollRef?.current ? scrollRef.current.scrollTop : window.scrollY;

    const onTouchStart = (e) => {
      if (getScrollTop() === 0) {
        startY.current = e.touches[0].clientY;
      }
    };

    const onTouchMove = (e) => {
      if (startY.current === null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0 && getScrollTop() === 0) {
        setPulling(true);
        setPullDistance(Math.min(dy * 0.5, threshold + 20));
        if (dy > 10) e.preventDefault();
      }
    };

    const onTouchEnd = async () => {
      if (pulling && pullDistance >= threshold && !refreshing) {
        setRefreshing(true);
        setPullDistance(0);
        setPulling(false);
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
        }
      } else {
        setPulling(false);
        setPullDistance(0);
      }
      startY.current = null;
    };

    const target = scrollRef?.current || document;
    target.addEventListener('touchstart', onTouchStart, { passive: true });
    target.addEventListener('touchmove', onTouchMove, { passive: false });
    target.addEventListener('touchend', onTouchEnd);

    return () => {
      target.removeEventListener('touchstart', onTouchStart);
      target.removeEventListener('touchmove', onTouchMove);
      target.removeEventListener('touchend', onTouchEnd);
    };
  }, [onRefresh, threshold, scrollRef, pulling, pullDistance, refreshing]);

  return { pulling, pullDistance, refreshing };
}