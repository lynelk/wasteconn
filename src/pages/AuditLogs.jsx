import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, isAfter, isBefore, parseISO, startOfDay, endOfDay } from 'date-fns';
import { Shield, AlertTriangle, Search, Eye, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

const riskColor = (score) => {
  if (!score) return 'text-muted-foreground';
  if (score >= 75) return 'text-red-600 font-bold';
  if (score >= 40) return 'text-yellow-600 font-semibold';
  return 'text-green-600';
};

const eventColor = {
  job_completion: 'bg-green-100 text-green-700',
  invoice_issued: 'bg-blue-100 text-blue-700',
  payment_settlement: 'bg-primary/10 text-primary',
  permission_change: 'bg-purple-100 text-purple-700',
  customer_created: 'bg-cyan-100 text-cyan-700',
  customer_updated: 'bg-cyan-100 text-cyan-700',
  ticket_closed: 'bg-gray-100 text-gray-600',
  login: 'bg-gray-100 text-gray-500',
  bulk_export: 'bg-orange-100 text-orange-700',
  data_delete: 'bg-red-100 text-red-700',
};

const EVENT_TYPES = [
  'job_completion','invoice_issued','payment_settlement','permission_change',
  'customer_created','customer_updated','ticket_closed','login','bulk_export','data_delete'
];

function exportCSV(rows) {
  const headers = ['Timestamp','User','Event','Entity Type','Entity ID','Risk Score','Flagged','Notes'];
  const lines = rows.map(l => [
    l.created_date ? format(new Date(l.created_date), 'yyyy-MM-dd HH:mm:ss') : '',
    l.user_email || l.user_id || '',
    l.event_type || '',
    l.entity_type || '',
    l.entity_id || '',
    l.risk_score ?? '',
    l.flagged ? 'Yes' : 'No',
    (l.notes || '').replace(/,/g, ';'),
  ]);
  const csv = [headers, ...lines].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'audit-log.csv'; a.click();
  URL.revokeObjectURL(url);
}

export default function AuditLogs() {
  const [search, setSearch] = useState('');
  const [eventFilter, setEventFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState(null);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => base44.entities.AuditLog.list('-created_date', 500),
  });

  const entityTypes = [...new Set(logs.map(l => l.entity_type).filter(Boolean))].sort();

  const filtered = logs.filter(l => {
    const matchSearch = !search ||
      l.user_email?.toLowerCase().includes(search.toLowerCase()) ||
      l.entity_type?.toLowerCase().includes(search.toLowerCase()) ||
      l.entity_id?.includes(search);
    const matchEvent = eventFilter === 'all' || l.event_type === eventFilter;
    const matchEntity = entityFilter === 'all' || l.entity_type === entityFilter;
    const matchFlagged = !flaggedOnly || l.flagged;
    const logDate = l.created_date ? new Date(l.created_date) : null;
    const matchFrom = !dateFrom || !logDate || isAfter(logDate, startOfDay(parseISO(dateFrom)));
    const matchTo = !dateTo || !logDate || isBefore(logDate, endOfDay(parseISO(dateTo)));
    return matchSearch && matchEvent && matchEntity && matchFlagged && matchFrom && matchTo;
  });

  const flaggedCount = logs.filter(l => l.flagged).length;
  const highRisk = logs.filter(l => (l.risk_score || 0) >= 75).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-jakarta flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" /> Audit Log
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Immutable record of all critical system events</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-center">
            <div className="text-lg font-bold text-red-600 font-jakarta">{flaggedCount}</div>
            <div className="text-xs text-red-500">Flagged</div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-center">
            <div className="text-lg font-bold text-orange-600 font-jakarta">{highRisk}</div>
            <div className="text-xs text-orange-500">High Risk</div>
          </div>
          <Button variant="outline" size="sm" onClick={() => exportCSV(filtered)} className="gap-2">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by user, entity, ID..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={eventFilter} onValueChange={setEventFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Event type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            {EVENT_TYPES.map(e => (
              <SelectItem key={e} value={e}>{e.replace(/_/g,' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Entity type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entities</SelectItem>
            {entityTypes.map(e => (
              <SelectItem key={e} value={e}>{e}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">From</span>
          <Input type="date" className="w-36" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <span className="text-xs text-muted-foreground">To</span>
          <Input type="date" className="w-36" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <button
          onClick={() => setFlaggedOnly(!flaggedOnly)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${flaggedOnly ? 'bg-red-50 border-red-300 text-red-700' : 'border-border text-muted-foreground hover:border-primary/50'}`}
        >
          <AlertTriangle className="w-4 h-4" /> Flagged Only
        </button>
        {(search || eventFilter !== 'all' || entityFilter !== 'all' || flaggedOnly || dateFrom || dateTo) && (
          <button
            onClick={() => { setSearch(''); setEventFilter('all'); setEntityFilter('all'); setFlaggedOnly(false); setDateFrom(''); setDateTo(''); }}
            className="px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:border-destructive/50 hover:text-destructive transition-all"
          >
            Clear filters
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground -mt-2">Showing {filtered.length} of {logs.length} entries</p>

      {/* Log Table */}
      <Card className="border-border/60">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-muted rounded animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No audit log entries found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Timestamp</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">User</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Event</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Entity</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Risk</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(log => (
                    <tr key={log.id} className={`border-b border-border/40 hover:bg-muted/20 transition-colors ${log.flagged ? 'bg-red-50/40' : ''}`}>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {log.created_date ? format(new Date(log.created_date), 'MMM d HH:mm') : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs">{log.user_email || log.user_id}</td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs ${eventColor[log.event_type] || 'bg-muted text-muted-foreground'}`} variant="secondary">
                          {log.event_type?.replace(/_/g,' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{log.entity_type} · <span className="font-mono">{log.entity_id?.slice(0,8)}</span></td>
                      <td className="px-4 py-3 text-xs">
                        <span className={riskColor(log.risk_score)}>
                          {log.risk_score != null ? `${log.risk_score}%` : '—'}
                        </span>
                        {log.flagged && <AlertTriangle className="w-3.5 h-3.5 text-red-500 inline ml-1" />}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => setSelected(log)} className="text-muted-foreground hover:text-foreground">
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelected(null)} />
          <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold font-jakarta">Audit Entry Detail</h3>
              <button onClick={() => setSelected(null)} className="text-muted-foreground">✕</button>
            </div>
            <dl className="space-y-3 text-sm">
              {[
                ['Event', selected.event_type?.replace(/_/g,' ')],
                ['User', selected.user_email],
                ['Entity', `${selected.entity_type} / ${selected.entity_id}`],
                ['Risk Score', selected.risk_score != null ? `${selected.risk_score}%` : 'N/A'],
                ['Flagged', selected.flagged ? 'Yes' : 'No'],
                ['IP Address', selected.ip_address || '—'],
                ['Notes', selected.notes || '—'],
              ].map(([k,v]) => (
                <div key={k} className="flex gap-3">
                  <dt className="text-muted-foreground w-28 shrink-0">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
              {selected.old_value && (
                <div>
                  <dt className="text-muted-foreground mb-1">Old Value</dt>
                  <pre className="bg-muted rounded-lg p-3 text-xs overflow-x-auto">{selected.old_value}</pre>
                </div>
              )}
              {selected.new_value && (
                <div>
                  <dt className="text-muted-foreground mb-1">New Value</dt>
                  <pre className="bg-muted rounded-lg p-3 text-xs overflow-x-auto">{selected.new_value}</pre>
                </div>
              )}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}