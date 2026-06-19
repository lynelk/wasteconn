import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useEntitiesByIds } from '@/hooks/useEntitiesByIds';
import { Plus, MessageSquare, Clock, Search, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TicketForm from '@/components/tickets/TicketForm';
import TicketDetail from '@/components/tickets/TicketDetail';
import { formatDistanceToNow } from 'date-fns';

const STATUS_COLORS = {
  open: 'bg-blue-100 text-blue-700',
  triaged: 'bg-purple-100 text-purple-700',
  assigned: 'bg-indigo-100 text-indigo-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  pending_evidence: 'bg-orange-100 text-orange-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-500',
  escalated: 'bg-red-100 text-red-700',
};

const PRIORITY_COLORS = {
  low: 'text-gray-500',
  medium: 'text-blue-600',
  high: 'text-orange-600',
  urgent: 'text-red-600',
};

const SOURCE_ICONS = {
  web_form: '🌐',
  whatsapp: '💬',
  email: '📧',
  phone: '📞',
  in_app: '📱',
  operator: '👤',
};

export default function OmniInbox() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['tickets'],
    queryFn: () => base44.entities.Ticket.list('-created_date', 200),
  });

  const { data: zones = [] } = useQuery({ queryKey: ['zones'], queryFn: () => base44.entities.ServiceZone.list() });
  // Resolve only the customers / service points referenced by the loaded
  // tickets (for labels), instead of fetching whole tables.
  const { rows: customers } = useEntitiesByIds('Customer', tickets.map(t => t.customer_id));
  const { rows: servicePoints } = useEntitiesByIds('ServicePoint', tickets.map(t => t.service_point_id));

  const filtered = tickets.filter(t => {
    const matchSearch = !search || t.subject?.toLowerCase().includes(search.toLowerCase()) ||
      t.description?.toLowerCase().includes(search.toLowerCase()) ||
      t.ticket_number?.toLowerCase().includes(search.toLowerCase()) ||
      t.customer_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchPriority = priorityFilter === 'all' || t.priority === priorityFilter;
    return matchSearch && matchStatus && matchPriority;
  });

  const open_ = filtered.filter(t => !['resolved', 'closed'].includes(t.status));
  const closed_ = filtered.filter(t => ['resolved', 'closed'].includes(t.status));
  const breached = filtered.filter(t => t.sla_breached);
  const escalated = filtered.filter(t => t.status === 'escalated');

  const getCustomer = id => customers.find(c => c.id === id);

  const isSLANear = (ticket) => {
    if (!ticket.sla_due_at || ['resolved','closed'].includes(ticket.status)) return false;
    return new Date(ticket.sla_due_at) < new Date(Date.now() + 2 * 3600000);
  };

  const TicketCard = ({ ticket }) => {
    const customer = getCustomer(ticket.customer_id);
    const slaWarning = isSLANear(ticket);

    return (
      <div
        className={`border rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow ${slaWarning ? 'border-orange-300 bg-orange-50/30' : 'border-border/60'}`}
        onClick={() => setSelected(ticket)}
      >
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base">{SOURCE_ICONS[ticket.source] || '📋'}</span>
            <span className="font-semibold text-sm">#{ticket.ticket_number || ticket.id.slice(0,8)}</span>
            <Badge className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[ticket.status]}`} variant="secondary">
              {ticket.status?.replace('_', ' ')}
            </Badge>
            <span className={`text-xs font-medium ${PRIORITY_COLORS[ticket.priority]}`}>
              {ticket.priority}
            </span>
            {ticket.sla_breached && <Badge className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0">SLA Breached</Badge>}
            {slaWarning && !ticket.sla_breached && <Badge className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0">SLA Near</Badge>}
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        </div>
        <p className="text-sm font-medium mb-0.5 line-clamp-1">{ticket.subject || ticket.description?.slice(0,60)}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          <span>{customer?.full_name || ticket.customer_name || 'Anonymous'}</span>
          <span className="capitalize">{ticket.category?.replace('_', ' ')}</span>
          {ticket.created_date && (
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDistanceToNow(new Date(ticket.created_date), { addSuffix: true })}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-jakarta flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-primary" /> Omni-Inbox
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Web form, WhatsApp & multi-channel ticket management</p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New Ticket
        </Button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Open', value: open_.length, color: 'text-blue-600' },
          { label: 'SLA Breached', value: breached.length, color: 'text-red-600' },
          { label: 'Escalated', value: escalated.length, color: 'text-orange-600' },
          { label: 'Resolved', value: closed_.length, color: 'text-green-600' },
        ].map(s => (
          <Card key={s.label} className="border-border/60">
            <CardContent className="pt-4 pb-4">
              <div className={`text-2xl font-bold font-jakarta ${s.color}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search tickets..." className="pl-9 h-8 text-xs" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {Object.keys(STATUS_COLORS).map(s => <SelectItem key={s} value={s}>{s.replace('_',' ')}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            {['low','medium','high','urgent'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="open">Open ({open_.length})</TabsTrigger>
          <TabsTrigger value="closed">Resolved/Closed ({closed_.length})</TabsTrigger>
          <TabsTrigger value="all">All ({filtered.length})</TabsTrigger>
        </TabsList>

        {[['open', open_], ['closed', closed_], ['all', filtered]].map(([tab, list]) => (
          <TabsContent key={tab} value={tab} className="mt-4 space-y-3">
            {isLoading ? (
              <div className="space-y-2">{[1,2,3].map(i=><div key={i} className="h-20 rounded-lg bg-muted animate-pulse"/>)}</div>
            ) : list.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No tickets</p>
              </div>
            ) : (
              list.map(t => <TicketCard key={t.id} ticket={t} />)
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* New Ticket Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-jakarta">New Support Ticket</DialogTitle>
          </DialogHeader>
          <TicketForm
            zones={zones}
            onClose={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Ticket Detail Modal */}
      {selected && (
        <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-jakarta">Ticket #{selected.ticket_number || selected.id.slice(0,8)}</DialogTitle>
            </DialogHeader>
            <TicketDetail
              ticket={selected}
              customers={customers}
              zones={zones}
              servicePoints={servicePoints}
              onClose={() => setSelected(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}