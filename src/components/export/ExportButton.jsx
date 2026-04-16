import { useState } from 'react';
import { Download, FileText, Table } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/AuthContext';

// Roles that are ALLOWED to export data
const EXPORT_ALLOWED_ROLES = ['admin', 'super_admin'];

function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadCSV(filename, columns, rows) {
  const header = columns.map(c => escapeCSV(c.label)).join(',');
  const body = rows.map(row =>
    columns.map(c => escapeCSV(typeof c.value === 'function' ? c.value(row) : row[c.key])).join(',')
  );
  const csv = [header, ...body].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadPDF(title, columns, rows) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: rows.length > 20 ? 'landscape' : 'portrait' });

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 18);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 25);

  // Table header
  let y = 34;
  const colWidth = (doc.internal.pageSize.getWidth() - 28) / columns.length;
  doc.setFillColor(34, 139, 84);
  doc.rect(14, y - 5, doc.internal.pageSize.getWidth() - 28, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  columns.forEach((col, i) => {
    doc.text(String(col.label).substring(0, 18), 14 + i * colWidth, y, { maxWidth: colWidth - 2 });
  });

  // Table rows
  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'normal');
  rows.forEach((row, ri) => {
    y += 8;
    if (y > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = 20;
    }
    if (ri % 2 === 0) {
      doc.setFillColor(245, 248, 245);
      doc.rect(14, y - 5, doc.internal.pageSize.getWidth() - 28, 8, 'F');
    }
    columns.forEach((col, i) => {
      const val = typeof col.value === 'function' ? col.value(row) : row[col.key];
      doc.text(String(val ?? '').substring(0, 22), 14 + i * colWidth, y, { maxWidth: colWidth - 2 });
    });
  });

  doc.save(`${title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.pdf`);
}

/**
 * ExportButton — drop-in export control for any data table.
 * Props:
 *   title      : string — report title & filename base
 *   columns    : [{ label, key, value? }] — key OR value fn
 *   rows       : array of data objects
 *   disabled   : bool (optional)
 */
export default function ExportButton({ title, columns, rows = [], disabled = false }) {
  const { user } = useAuth();
  const role = user?.role || 'user';
  const [busy, setBusy] = useState(false);

  // Role-based access check — silently hide for unauthorized roles
  if (!EXPORT_ALLOWED_ROLES.includes(role)) return null;

  const handleCSV = () => {
    downloadCSV(`${title}_${new Date().toISOString().slice(0,10)}.csv`, columns, rows);
  };

  const handlePDF = async () => {
    setBusy(true);
    await downloadPDF(title, columns, rows);
    setBusy(false);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || busy} className="gap-2">
          <Download className="w-4 h-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleCSV} className="gap-2 cursor-pointer">
          <Table className="w-4 h-4 text-green-600" /> Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePDF} className="gap-2 cursor-pointer">
          <FileText className="w-4 h-4 text-red-600" /> Export as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}