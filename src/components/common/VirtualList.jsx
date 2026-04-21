import { useMemo } from 'react';

/** Renders a lightweight windowed list for large datasets. */
export default function VirtualList({ items = [], itemHeight = 56, containerHeight = 320, scrollTop = 0, renderItem }) {
  const totalHeight = items.length * itemHeight;
  const start = Math.max(Math.floor(scrollTop / itemHeight) - 3, 0);
  const visibleCount = Math.ceil(containerHeight / itemHeight) + 6;
  const end = Math.min(start + visibleCount, items.length);

  const visibleItems = useMemo(() => items.slice(start, end), [items, start, end]);

  return (
    <div style={{ height: containerHeight, overflowY: 'auto' }}>
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map((item, idx) => {
          const index = start + idx;
          return (
            <div key={item.id ?? index} style={{ position: 'absolute', top: index * itemHeight, left: 0, right: 0, height: itemHeight }}>
              {renderItem(item, index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
