import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * DownloadTemplateButton
 *
 * Props:
 *  - filename: base filename without extension e.g. "customer_import_template"
 *  - columns: array of { key, label, sample } objects
 *    key    → column header used in CSV / XLSX
 *    label  → friendly name shown in the XLSX "Instructions" tab (falls back to key)
 *    sample → example value placed in row 2
 *  - required: array of column keys that are required (shown with * in XLSX)
 */
export default function DownloadTemplateButton({ filename, columns, required = [], size = 'sm' }) {
  const headers = columns.map(c => c.key);
  const sampleRow = columns.map(c => c.sample ?? '');

  const downloadCSV = () => {
    const csv = [headers.join(','), sampleRow.map(v => `"${v}"`).join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const downloadXLSX = () => {
    const wb = XLSX.utils.book_new();

    // ── Data sheet ────────────────────────────────────────────────────────────
    const dataWs = XLSX.utils.aoa_to_sheet([headers, sampleRow]);

    // Bold the header row
    headers.forEach((_, ci) => {
      const cellAddr = XLSX.utils.encode_cell({ r: 0, c: ci });
      if (!dataWs[cellAddr]) return;
      dataWs[cellAddr].s = { font: { bold: true } };
    });

    // Auto column widths
    dataWs['!cols'] = columns.map(c => ({ wch: Math.max((c.key || '').length, (String(c.sample || '')).length, 14) }));
    XLSX.utils.book_append_sheet(wb, dataWs, 'Import Data');

    // ── Instructions sheet ────────────────────────────────────────────────────
    const instrRows = [
      ['Field', 'Required?', 'Example', 'Notes'],
      ...columns.map(c => [
        c.key,
        required.includes(c.key) ? 'Yes ✱' : 'No',
        c.sample ?? '',
        c.notes ?? '',
      ]),
    ];
    const instrWs = XLSX.utils.aoa_to_sheet(instrRows);
    instrWs['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 28 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, instrWs, 'Instructions');

    XLSX.writeFile(wb, `${filename}.xlsx`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={size} className="gap-1.5 shrink-0">
          <Download className="w-3.5 h-3.5" />
          Template
          <ChevronDown className="w-3 h-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={downloadCSV} className="gap-2 cursor-pointer">
          <Download className="w-3.5 h-3.5" />
          Download CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={downloadXLSX} className="gap-2 cursor-pointer">
          <Download className="w-3.5 h-3.5" />
          Download XLSX
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}