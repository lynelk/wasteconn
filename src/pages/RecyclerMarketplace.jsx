import { useAuth } from '@/lib/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShieldAlert, LayoutGrid, Users, MessageSquare, CheckCircle } from 'lucide-react';
import ListingsBoard from '@/components/recycler/ListingsBoard';
import BuyerManagementTab from '@/components/recycler/BuyerManagementTab';
import OffersQueue from '@/components/recycler/OffersQueue';
import RecyclerSettlementsTab from '@/components/recycler/RecyclerSettlementsTab';

const ALLOWED = ['admin', 'super_admin', 'dispatcher'];

export default function RecyclerMarketplace() {
  const { user } = useAuth();
  const role = user?.role;

  if (!ALLOWED.includes(role)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <ShieldAlert className="w-10 h-10" />
        <p className="font-medium">Access restricted.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-jakarta text-foreground">Recycler Marketplace</h1>
        <p className="text-muted-foreground text-sm mt-1">Post material lots, manage buyer offers, and settle recycler transactions.</p>
      </div>

      <Tabs defaultValue="listings">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="listings" className="gap-1.5 text-xs">
            <LayoutGrid className="w-3.5 h-3.5" /> Listings
          </TabsTrigger>
          <TabsTrigger value="buyers" className="gap-1.5 text-xs">
            <Users className="w-3.5 h-3.5" /> Buyers
          </TabsTrigger>
          <TabsTrigger value="offers" className="gap-1.5 text-xs">
            <MessageSquare className="w-3.5 h-3.5" /> Offers Queue
          </TabsTrigger>
          <TabsTrigger value="settlements" className="gap-1.5 text-xs">
            <CheckCircle className="w-3.5 h-3.5" /> Settlements
          </TabsTrigger>
        </TabsList>

        <TabsContent value="listings" className="mt-4"><ListingsBoard /></TabsContent>
        <TabsContent value="buyers" className="mt-4"><BuyerManagementTab /></TabsContent>
        <TabsContent value="offers" className="mt-4"><OffersQueue /></TabsContent>
        <TabsContent value="settlements" className="mt-4"><RecyclerSettlementsTab /></TabsContent>
      </Tabs>
    </div>
  );
}