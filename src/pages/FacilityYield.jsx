import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldAlert, ClipboardList, BarChart3, Send } from 'lucide-react';
import YieldEntryForm from '@/components/facility/YieldEntryForm';
import YieldTrendChart from '@/components/facility/YieldTrendChart';
import OutboundShipmentsTable from '@/components/facility/OutboundShipmentsTable';
import YieldKPIHeader from '@/components/facility/YieldKPIHeader';

const ALLOWED = ['admin', 'super_admin'];

// Static facility list — replace with DisposalSite entity once available
const DEMO_FACILITIES = [
  { id: 'fac-001', name: 'Kiteezi Landfill & MRF' },
  { id: 'fac-002', name: 'Kampala W2E Facility' },
  { id: 'fac-003', name: 'Entebbe Recycling Centre' },
];

export default function FacilityYield() {
  const { user } = useAuth();
  const role = user?.role;
  const [facilityId, setFacilityId] = useState(DEMO_FACILITIES[0].id);

  if (!ALLOWED.includes(role)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <ShieldAlert className="w-10 h-10" />
        <p className="font-medium">Access restricted to Admin and Super Admin.</p>
      </div>
    );
  }

  const selectedFacility = DEMO_FACILITIES.find(f => f.id === facilityId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-jakarta text-foreground">Facility Yield & Diversion</h1>
          <p className="text-muted-foreground text-sm mt-1">Track inbound waste, sorting fractions, diversion rates, and outbound shipments per facility.</p>
        </div>
        <div className="w-64">
          <Select value={facilityId} onValueChange={setFacilityId}>
            <SelectTrigger><SelectValue placeholder="Select facility…" /></SelectTrigger>
            <SelectContent>
              {DEMO_FACILITIES.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <YieldKPIHeader facilityId={facilityId} />

      <Tabs defaultValue="entry">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="entry" className="gap-1.5 text-xs">
            <ClipboardList className="w-3.5 h-3.5" /> Daily Entry
          </TabsTrigger>
          <TabsTrigger value="trend" className="gap-1.5 text-xs">
            <BarChart3 className="w-3.5 h-3.5" /> Yield Trends
          </TabsTrigger>
          <TabsTrigger value="shipments" className="gap-1.5 text-xs">
            <Send className="w-3.5 h-3.5" /> Outbound Shipments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="entry" className="mt-4">
          <YieldEntryForm facilityId={facilityId} facilityName={selectedFacility?.name} />
        </TabsContent>
        <TabsContent value="trend" className="mt-4">
          <YieldTrendChart facilityId={facilityId} />
        </TabsContent>
        <TabsContent value="shipments" className="mt-4">
          <OutboundShipmentsTable facilityId={facilityId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}