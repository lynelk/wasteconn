import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, MapPin, ClipboardList, BarChart3, CreditCard, ShieldAlert } from 'lucide-react';
import SubcontractorTable from '@/components/subcontractors/SubcontractorTable';
import SubcontractorOnboardForm from '@/components/subcontractors/SubcontractorOnboardForm';
import SubcontractorAllocationBoard from '@/components/subcontractors/SubcontractorAllocationBoard';
import SubcontractorSLAScorecard from '@/components/subcontractors/SubcontractorSLAScorecard';
import SubcontractorPayoutTab from '@/components/subcontractors/SubcontractorPayoutTab';
import SubcontractorCoverageMap from '@/components/subcontractors/SubcontractorCoverageMap';

export default function SubcontractorHub() {
  const { user } = useAuth();
  const role = user?.role;

  if (!['admin', 'super_admin'].includes(role)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <ShieldAlert className="w-10 h-10" />
        <p className="font-medium">Access restricted to Admin and Super Admin.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-jakarta text-foreground">Subcontractor Hub</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage subcontractors, allocate jobs, monitor SLA performance and settle payouts.</p>
      </div>

      <Tabs defaultValue="subcontractors">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="subcontractors" className="gap-1.5 text-xs">
            <Building2 className="w-3.5 h-3.5" /> Subcontractors
          </TabsTrigger>
          <TabsTrigger value="coverage" className="gap-1.5 text-xs">
            <MapPin className="w-3.5 h-3.5" /> Coverage Map
          </TabsTrigger>
          <TabsTrigger value="allocation" className="gap-1.5 text-xs">
            <ClipboardList className="w-3.5 h-3.5" /> Job Allocation
          </TabsTrigger>
          <TabsTrigger value="sla" className="gap-1.5 text-xs">
            <BarChart3 className="w-3.5 h-3.5" /> SLA Scorecards
          </TabsTrigger>
          <TabsTrigger value="payouts" className="gap-1.5 text-xs">
            <CreditCard className="w-3.5 h-3.5" /> Payouts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="subcontractors" className="mt-4">
          <SubcontractorTable />
        </TabsContent>
        <TabsContent value="coverage" className="mt-4">
          <SubcontractorCoverageMap />
        </TabsContent>
        <TabsContent value="allocation" className="mt-4">
          <SubcontractorAllocationBoard />
        </TabsContent>
        <TabsContent value="sla" className="mt-4">
          <SubcontractorSLAScorecard />
        </TabsContent>
        <TabsContent value="payouts" className="mt-4">
          <SubcontractorPayoutTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}