/**
 * ResponsiveTable — renders a <table> on desktop, card-list on mobile.
 *
 * Props:
 *   columns  — [{ key, label, render?: (row) => ReactNode, mobileHide?: bool }]
 *   rows     — array of data objects (must have .id)
 *   actions  — (row) => ReactNode  (optional per-row actions)
 *   loading  — bool
 *   emptyText — string
 */
import { useIsMobile } from '@/hooks/use-mobile';

export default function ResponsiveTable({ columns = [], rows = [], actions, loading = false, emptyText = 'No data found.' }) {
  const isMobile = useIsMobile();

  if (loading) {
    return (
      <div className="space-y-2">
        {[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />)}
      </div>
    );
  }

  if (!rows.length) {
    return <p className="text-center py-10 text-sm text-muted-foreground">{emptyText}</p>;
  }

  // Mobile — card view
  if (isMobile) {
    const visibleCols = columns.filter(c => !c.mobileHide);
    const [primaryCol, ...restCols] = visibleCols;
    return (
      <div className="space-y-2">
        {rows.map(row => (
          <div key={row.id} className="rounded-xl border border-border/60 bg-card px-4 py-3 space-y-2">
            {/* Primary label */}
            <div className="flex items-start justify-between gap-2">
              <div className="font-semibold text-sm text-foreground">
                {primaryCol?.render ? primaryCol.render(row) : row[primaryCol?.key] ?? '—'}
              </div>
              {actions && <div className="shrink-0">{actions(row)}</div>}
            </div>
            {/* Rest of columns */}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
              {restCols.map(col => (
                <div key={col.key} className="flex flex-col">
                  <dt className="text-[10px] text-muted-foreground uppercase tracking-wide">{col.label}</dt>
                  <dd className="text-xs text-foreground">
                    {col.render ? col.render(row) : (row[col.key] ?? '—')}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    );
  }

  // Desktop — table view
  return (
    <div className="overflow-x-auto rounded-xl border border-border/60">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/30 border-b border-border/60">
            {columns.map(col => (
              <th key={col.key} className="text-left text-xs font-medium text-muted-foreground px-4 py-3">{col.label}</th>
            ))}
            {actions && <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
              {columns.map(col => (
                <td key={col.key} className="px-4 py-3">
                  {col.render ? col.render(row) : (row[col.key] ?? '—')}
                </td>
              ))}
              {actions && <td className="px-4 py-3">{actions(row)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}