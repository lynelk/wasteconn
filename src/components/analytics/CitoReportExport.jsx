import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, FileText, RefreshCw, AlertTriangle } from 'lucide-react';
import { jsPDF } from 'jspdf';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

function exportCSV(rows, filename) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const csv = [keys.join(','), ...rows.map(r => keys.map(k => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function exportPDF(transactions, smsLogs, month, year) {
  const doc = new jsPDF();
  const title = `CitoConnect Report — ${month} ${year}`;

  doc.setFontSize(18);
  doc.text(title, 14, 20);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

  // Summary
  doc.setFontSize(13);
  doc.text('Transaction Summary', 14, 40);
  doc.setFontSize(10);

  const byType = {};
  transactions.forEach(t => {
    const type = t.type || 'unknown';
    if (!byType[type]) byType[type] = { count: 0, total: 0 };
    byType[type].count++;
    byType[type].total += t.amount || 0;
  });

  let y = 48;
  Object.entries(byType).forEach(([type, data]) => {
    doc.text(`${type.toUpperCase()}: ${data.count} transactions — ${data.total.toLocaleString()} UGX`, 14, y);
    y += 7;
  });

  // Transactions table
  y += 5;
  doc.setFontSize(13);
  doc.text('Transactions', 14, y);
  y += 8;
  doc.setFontSize(9);
  doc.text('Reference', 14, y);
  doc.text('Type', 60, y);
  doc.text('Amount (UGX)', 100, y);
  doc.text('Status', 150, y);
  y += 5;
  doc.line(14, y, 195, y);
  y += 4;

  transactions.slice(0, 40).forEach(t => {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.text(String(t.reference || '—').slice(0, 20), 14, y);
    doc.text(String(t.type || '—'), 60, y);
    doc.text(String((t.amount || 0).toLocaleString()), 100, y);
    doc.text(String(t.status || '—'), 150, y);
    y += 6;
  });

  // SMS logs
  if (smsLogs.length > 0) {
    y += 8;
    if (y > 260) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.text('SMS Logs', 14, y);
    y += 8;
    doc.setFontSize(9);
    doc.text('Recipient', 14, y);
    doc.text('Status', 80, y);
    doc.text('Date', 120, y);
    y += 5;
    doc.line(14, y, 195, y);
    y += 4;
    smsLogs.slice(0, 30).forEach(s => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(String(s.recipient_phone || '—'), 14, y);
      doc.text(String(s.status || '—'), 80, y);
      doc.text(String(s.sent_at ? new Date(s.sent_at).toLocaleDateString() : '—'), 120, y);
      y += 6;
    });
  }

  doc.save(`citoconnect_report_${month}_${year}.pdf`);
}

export default function CitoReportExport() {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth()));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setStats(null);

    // Fetch CitoConnect transaction stats
    const statsRes = await base44.functions.invoke('citoConnectService', { action: 'get_transaction_stats' });

    // Fetch local SMS notification logs for the selected month
    const allNotifications = await base44.entities.Notification.filter({ channel: 'sms' });
    const selectedMonth = parseInt(month);
    const selectedYear = parseInt(year);
    const smsLogs = allNotifications.filter(n => {
      const d = new Date(n.created_date || n.sent_at);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });

    // Build transaction rows from IntegrationQueue
    const allQueue = await base44.entities.IntegrationQueue.list('-created_date', 500);
    const transactions = allQueue
      .filter(q => {
        const d = new Date(q.created_date);
        return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear && q.event_type === 'payment_webhook';
      })
      .map(q => {
        const p = (() => { try { return JSON.parse(q.payload); } catch { return {}; } })();
        return {
          reference: p.reference || q.idempotency_key || '—',
          type: p.event_type?.replace('payment.', '') || p.event_type || 'payment',
          amount: p.data?.amount || 0,
          status: q.status,
          date: new Date(q.created_date).toLocaleDateString(),
        };
      });

    setStats({ transactions, smsLogs, citoStats: statsRes.data });
    setLoading(false);
  };

  const handleExportCSV = () => {
    if (!stats) return;
    const monthName = MONTHS[parseInt(month)];
    exportCSV(
      stats.transactions.map(t => ({ ...t, category: 'transaction' })).concat(
        stats.smsLogs.map(s => ({
          reference: s.provider_message_id || '—',
          type: 'sms',
          amount: 0,
          status: s.status,
          date: s.sent_at ? new Date(s.sent_at).toLocaleDateString() : '—',
          category: 'sms',
          recipient: s.recipient_phone || '—',
        }))
      ),
      `citoconnect_report_${monthName}_${year}.csv`
    );
  };

  const handleExportPDF = () => {
    if (!stats) return;
    exportPDF(stats.transactions, stats.smsLogs, MONTHS[parseInt(month)], year);
  };

  const years = [String(now.getFullYear()), String(now.getFullYear() - 1)];

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold font-jakarta flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" /> CitoConnect Monthly Report
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Month</p>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Year</p>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={fetchData} disabled={loading} className="gap-2 h-8">
            {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Load Report
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <AlertTriangle className="w-3 h-3" /> {error}
          </div>
        )}

        {stats && (
          <div className="space-y-3">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Transactions', value: stats.transactions.length, color: 'text-primary' },
                { label: 'SMS Logs', value: stats.smsLogs.length, color: 'text-blue-600' },
                { label: 'API Success Rate', value: stats.citoStats?.success_rate ? `${stats.citoStats.success_rate}%` : '—', color: 'text-green-600' },
              ].map(s => (
                <div key={s.label} className="rounded-lg bg-muted/50 p-3">
                  <p className={`text-xl font-bold font-jakarta ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>

            {/* By type breakdown */}
            {stats.transactions.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">By Transaction Type</p>
                {Object.entries(
                  stats.transactions.reduce((acc, t) => {
                    acc[t.type] = (acc[t.type] || 0) + 1;
                    return acc;
                  }, {})
                ).map(([type, count]) => (
                  <div key={type} className="flex justify-between text-xs py-1 border-b border-border/30">
                    <span className="capitalize text-foreground">{type}</span>
                    <span className="text-muted-foreground">{count} record{count !== 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Export buttons */}
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={handleExportCSV} className="gap-2 h-8 text-xs">
                <Download className="w-3 h-3" /> Export CSV
              </Button>
              <Button size="sm" variant="outline" onClick={handleExportPDF} className="gap-2 h-8 text-xs">
                <Download className="w-3 h-3" /> Export PDF
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}