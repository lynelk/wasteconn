import { useState } from 'react';
import { FileText, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import jsPDF from 'jspdf';

const statusColor = {
  issued: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  partially_paid: 'bg-yellow-100 text-yellow-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

export default function CustomerInvoiceCard({ invoice, customer }) {
  const [expanded, setExpanded] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const downloadPDF = () => {
    setDownloading(true);
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();

    // Header
    doc.setFillColor(34, 139, 34);
    doc.rect(0, 0, pageW, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('NLSWMS', 15, 18);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('NLS Waste Management System', 15, 27);
    doc.text('INVOICE', pageW - 15, 18, { align: 'right' });
    doc.text(`#${invoice.invoice_number}`, pageW - 15, 27, { align: 'right' });

    // Invoice Info
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(10);
    let y = 55;
    doc.setFont('helvetica', 'bold');
    doc.text('Bill To:', 15, y);
    doc.setFont('helvetica', 'normal');
    doc.text(customer?.full_name || 'Customer', 15, y + 7);
    doc.text(customer?.address || '', 15, y + 14);
    doc.text(customer?.phone || '', 15, y + 21);

    doc.setFont('helvetica', 'bold');
    doc.text('Invoice Details:', pageW / 2, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`Issue Date: ${invoice.issue_date ? format(new Date(invoice.issue_date), 'MMM d, yyyy') : '-'}`, pageW / 2, y + 7);
    doc.text(`Due Date: ${invoice.due_date ? format(new Date(invoice.due_date), 'MMM d, yyyy') : '-'}`, pageW / 2, y + 14);
    doc.text(`Status: ${invoice.status?.toUpperCase()}`, pageW / 2, y + 21);

    y += 40;

    // Items table
    doc.setFillColor(240, 240, 240);
    doc.rect(15, y, pageW - 30, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Description', 18, y + 5.5);
    doc.text('Qty', pageW - 80, y + 5.5);
    doc.text('Unit Price', pageW - 60, y + 5.5);
    doc.text('Total', pageW - 25, y + 5.5, { align: 'right' });
    y += 12;

    doc.setFont('helvetica', 'normal');
    const items = invoice.items || [{ description: 'Waste Collection Service', quantity: 1, unit_price_ugx: invoice.amount_ugx, total_ugx: invoice.amount_ugx }];
    items.forEach(item => {
      doc.text(item.description || '', 18, y);
      doc.text(String(item.quantity || 1), pageW - 80, y);
      doc.text(`UGX ${(item.unit_price_ugx || 0).toLocaleString()}`, pageW - 60, y);
      doc.text(`UGX ${(item.total_ugx || 0).toLocaleString()}`, pageW - 25, y, { align: 'right' });
      y += 8;
    });

    // Total
    y += 4;
    doc.setDrawColor(34, 139, 34);
    doc.line(15, y, pageW - 15, y);
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('TOTAL DUE:', pageW - 70, y);
    doc.setTextColor(34, 139, 34);
    doc.text(`UGX ${(invoice.amount_ugx || 0).toLocaleString()}`, pageW - 15, y, { align: 'right' });

    if (invoice.notes) {
      y += 20;
      doc.setTextColor(30, 30, 30);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Notes: ${invoice.notes}`, 15, y);
    }

    doc.save(`invoice-${invoice.invoice_number}.pdf`);
    setDownloading(false);
  };

  return (
    <Card className="border-border/60">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center mt-0.5">
              <FileText className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">#{invoice.invoice_number}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Due: {invoice.due_date ? format(new Date(invoice.due_date), 'MMM d, yyyy') : '—'}
              </p>
              <p className="text-sm font-bold text-foreground mt-1">UGX {(invoice.amount_ugx || 0).toLocaleString()}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge className={`text-xs ${statusColor[invoice.status] || ''}`} variant="secondary">
              {invoice.status?.replace('_', ' ')}
            </Badge>
            <div className="flex gap-1">
              <button
                onClick={downloadPDF}
                disabled={downloading}
                className="flex items-center gap-1 text-xs text-primary bg-primary/10 px-2 py-1.5 rounded-lg hover:bg-primary/20 disabled:opacity-50"
              >
                <Download className="w-3 h-3" /> {downloading ? '...' : 'PDF'}
              </button>
              <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground p-1.5">
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {expanded && invoice.items?.length > 0 && (
          <div className="mt-4 border-t border-border/40 pt-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Items</p>
            <div className="space-y-1.5">
              {invoice.items.map((item, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{item.description} × {item.quantity}</span>
                  <span className="font-medium">UGX {(item.total_ugx || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}