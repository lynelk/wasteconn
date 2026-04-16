import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Users, Edit2, Trash2, Search, Phone, MapPin,
  Upload, Building2, User, Briefcase, Crown, MapPinned
} from 'lucide-react';
import ExportButton from '@/components/export/ExportButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import CustomerForm from '@/components/customers/CustomerForm';
import BulkImportModal from '@/components/customers/BulkImportModal';
import ServicePointForm from '@/components/customers/ServicePointForm';

const statusColor = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-600',
  suspended: 'bg-red-100 text-red-700',
};
const typeColor = {
  residential: 'bg-blue-100 text-blue-700',
  commercial: 'bg-purple-100 text-purple-700',
  industrial: 'bg-orange-100 text-orange-700',
};
const segmentIcon = {
  individual: User,
  sme: Briefcase,
  institution: Building2,
};
const tierColor = {
  basic: 'bg-gray-100 text-gray-600',
  standard: 'bg-blue-100 text-blue-700',
  premium: 'bg-purple-100 text-purple-700',
  enterprise: 'bg-amber-100 text-amber-700',
};

export default function Customers() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterSegment, setFilterSegment] = useState('all');
  const [tab, setTab] = useState('customers');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [spOpen, setSpOpen] = useState(false);
  const [editingSP, setEditingSP] = useState(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list('-created_date'),
  });
  const { data: servicePoints = [], isLoading: spLoading } = useQuery({
    queryKey: ['servicePoints'],
    queryFn: () => base44.entities.ServicePoint.list('-created_date'),
  });
  const { data: zones = [] } = useQuery({ queryKey: ['zones'], queryFn: () => base44.entities.ServiceZone.list() });

  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.Customer.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });
  const deleteSPMutation = useMutation({
    mutationFn: id => base44.entities.ServicePoint.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['servicePoints'] }),
  });

  const zoneMap = Object.fromEntries(zones.map(z => [z.id, z.zone_name]));
  const customerMap = Object.fromEntries(customers.map(c => [c.id, c]));

  const filtered = customers.filter(c => {
    const matchSearch = c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search) || c.account_number?.includes(search) ||
      c.institution_name?.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || c.customer_type === filterType;
    const matchSeg = filterSegment === 'all' || c.customer_segment === filterSegment;
    return matchSearch && matchType && matchSeg;
  });

  const stats = {
    total: customers.length,
    individual: customers.filter(c => (c.customer_segment || 'individual') === 'individual').length,
    sme: customers.filter(c => c.customer_segment === 'sme').length,
    institution: customers.filter(c => c.customer_segment === 'institution').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-jakarta">Customers</h1>
          <p className="text-muted-foreground text-sm mt-1">{stats.total} total · {stats.individual} individuals · {stats.sme} SMEs · {stats.institution} institutions</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ExportButton
            title="Customers"
            columns={[
              { label: 'Name', key: 'full_name' },
              { label: 'Phone', key: 'phone' },
              { label: 'Email', key: 'email' },
              { label: 'Segment', key: 'customer_segment' },
              { label: 'Type', key: 'customer_type' },
              { label: 'Tier', key: 'customer_tier' },
              { label: 'District', key: 'district' },
              { label: 'Status', key: 'status' },
            ]}
            rows={customers}
          />
          <Button variant="outline" onClick={() => setBulkOpen(true)} className="gap-2">
            <Upload className="w-4 h-4" /> Bulk Import
          </Button>
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Add Customer
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="service_points">Service Points ({servicePoints.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="customers" className="mt-4 space-y-4">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search by name, phone, institution..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={filterSegment} onValueChange={setFilterSegment}>
              <SelectTrigger className="w-36"><SelectValue placeholder="All segments" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Segments</SelectItem>
                <SelectItem value="individual">Individual</SelectItem>
                <SelectItem value="sme">SME</SelectItem>
                <SelectItem value="institution">Institution</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-36"><SelectValue placeholder="All types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="residential">Residential</SelectItem>
                <SelectItem value="commercial">Commercial</SelectItem>
                <SelectItem value="industrial">Industrial</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No customers found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(c => {
                const SegIcon = segmentIcon[c.customer_segment] || User;
                return (
                  <div key={c.id} className="flex items-center gap-4 p-4 rounded-xl border border-border/60 bg-card hover:shadow-sm transition-shadow">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <SegIcon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{c.institution_name || c.full_name}</p>
                        {c.is_branch && <Badge variant="outline" className="text-xs">Branch</Badge>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        {c.institution_name && <span>{c.full_name}</span>}
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>
                        {c.district && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.district}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <Badge className={`text-xs ${tierColor[c.customer_tier] || tierColor.basic}`} variant="secondary">
                        {c.customer_tier || 'basic'}
                      </Badge>
                      <Badge className={`text-xs ${typeColor[c.customer_type]}`} variant="secondary">{c.customer_type}</Badge>
                      <Badge className={`text-xs ${statusColor[c.status]}`} variant="secondary">{c.status}</Badge>
                      <button onClick={() => { setSelectedCustomerId(c.id); setEditingSP(null); setSpOpen(true); }} className="text-muted-foreground hover:text-primary p-1.5" title="Add Service Point">
                        <MapPinned className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { setEditing(c); setOpen(true); }} className="text-muted-foreground hover:text-foreground p-1.5">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteMutation.mutate(c.id)} className="text-muted-foreground hover:text-destructive p-1.5">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="service_points" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{servicePoints.length} service points registered</p>
            <Button onClick={() => { setSelectedCustomerId(null); setEditingSP(null); setSpOpen(true); }} className="gap-2" size="sm">
              <Plus className="w-4 h-4" /> Add Service Point
            </Button>
          </div>
          {spLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
          ) : servicePoints.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <MapPinned className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No service points yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {servicePoints.map(sp => {
                const cust = customerMap[sp.customer_id];
                return (
                  <div key={sp.id} className="flex items-center gap-4 p-4 rounded-xl border border-border/60 bg-card hover:shadow-sm transition-shadow">
                    <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{sp.name || 'Unnamed'}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        <span>{sp.address}</span>
                        {sp.landmark && <span>· Near {sp.landmark}</span>}
                        <span>· {cust?.full_name || 'Unknown customer'}</span>
                        {sp.zone_id && <span>· {zoneMap[sp.zone_id] || 'Zone'}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary" className={`text-xs ${sp.status === 'active' ? 'bg-green-100 text-green-700' : sp.status === 'pending_approval' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                        {sp.status}
                      </Badge>
                      {sp.latitude && <span className="text-xs text-muted-foreground">{Number(sp.latitude).toFixed(4)}, {Number(sp.longitude).toFixed(4)}</span>}
                      {sp.change_history?.length > 0 && <Badge variant="outline" className="text-xs">{sp.change_history.length} changes</Badge>}
                      <button onClick={() => { setEditingSP(sp); setSelectedCustomerId(sp.customer_id); setSpOpen(true); }} className="text-muted-foreground hover:text-foreground p-1.5">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteSPMutation.mutate(sp.id)} className="text-muted-foreground hover:text-destructive p-1.5">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Customer Form Dialog */}
      <Dialog open={open} onOpenChange={() => { setOpen(false); setEditing(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-jakarta">{editing ? 'Edit Customer' : 'New Customer Onboarding'}</DialogTitle>
          </DialogHeader>
          <CustomerForm customer={editing} onClose={() => { setOpen(false); setEditing(null); }} />
        </DialogContent>
      </Dialog>

      {/* Bulk Import */}
      <BulkImportModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onComplete={() => qc.invalidateQueries({ queryKey: ['customers'] })}
      />

      {/* Service Point Form */}
      <Dialog open={spOpen} onOpenChange={() => { setSpOpen(false); setEditingSP(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-jakarta">{editingSP ? 'Edit Service Point' : 'Add Service Point'}</DialogTitle>
          </DialogHeader>
          <ServicePointForm servicePoint={editingSP} customerId={selectedCustomerId} onClose={() => { setSpOpen(false); setEditingSP(null); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}