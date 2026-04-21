import { useMemo } from 'react';

export default function DataTable({ columns = [], rows = [], emptyText = 'No records found' }) {
  const safeRows = useMemo(() => rows ?? [], [rows]);

  if (!safeRows.length) {
    return <div className="text-sm text-muted-foreground">{emptyText}</div>;
  }

  return (
    <div className="overflow-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/40">
            {columns.map((column) => (
              <th key={column.key} className="px-3 py-2 text-left font-medium">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {safeRows.map((row, index) => (
            <tr key={row.id ?? index} className="border-t">
              {columns.map((column) => (
                <td key={column.key} className="px-3 py-2">
                  {column.render ? column.render(row) : row[column.key] ?? '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
