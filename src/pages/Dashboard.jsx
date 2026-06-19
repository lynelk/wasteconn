import { Suspense, lazy } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Users, MapPin, Calendar, CreditCard, MessageSquare, Truck, AlertCircle, Package, Map } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import DashboardCharts from '@/components/dashboard/DashboardCharts';
import { ANALYTICS_SCAN_LIMIT } from '@/lib/pagination';

const DashboardMap = lazy(() => import('@/components/dashboard/DashboardMap'));

function StatCard({ title, value, icon: IconComponent, color, sub }) {
  return (
    <Card className="border-border/60">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-3xl font-bold font-jakarta mt-1">{value ?? '—'}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={`p-2.5 rounded-xl ${color}`}>
            <IconComponent className="w-5 h-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const statusColor = {
  pending: 'bg-yellow-100 text-yellow-700',
  assigned: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function Dashboard() {
  const { user } = useAuth();
  const role = user?.role || 'user';

  // Bound the high-cardinality scans to the most recent N records (disclosed
  // below) so the dashboard never pulls whole tables. Low-cardinality entities
  // (vehicles, inventory, routes, zones, tenants) stay unbounded.
  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: () => base44.entities.Customer.list('-created_date', ANALYTICS_SCAN_LIMIT) });
  const { data: pickups = [] } = useQuery({ queryKey: ['pickups'], queryFn: () => base44.entities.PickupRequest.list('-created_date', ANALYTICS_SCAN_LIMIT) });
  const { data: payments = [] } = useQuery({ queryKey: ['payments'], queryFn: () => base44.entities.Payment.list('-created_date', ANALYTICS_SCAN_LIMIT) });
  const { data: complaints = [] } = useQuery({ queryKey: ['complaints'], queryFn: () => base44.entities.Complaint.list('-created_date', ANALYTICS_SCAN_LIMIT) });
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });
  const { data: inventory = [] } = useQuery({ queryKey: ['inventory'], queryFn: () => base44.entities.Inventory.list() });
  const { data: servicePoints = [] } = useQuery({ queryKey: ['service-points'], queryFn: () => base44.entities.ServicePoint.list('-created_date', ANALYTICS_SCAN_LIMIT) });
  const { data: routes = [] } = useQuery({ queryKey: ['routes-today'], queryFn: () => base44.entities.Route.filter({ route_date: format(new Date(), 'yyyy-MM-dd') }) });
  const { data: tenants = [] } = useQuery({ queryKey: ['tenants'], queryFn: () => base44.entities.Tenant.list(), enabled: role === 'super_admin' });
  const { data: zones = [] } = useQuery({ queryKey: ['service-zones'], queryFn: () => base44.entities.ServiceZone.list() });

  const pendingPickups = pickups.filter(p => p.status === 'pending').length;
  const openComplaints = complaints.filter(c => c.status === 'open').length;
  const totalRevenue = payments.filter(p => p.status === 'completed').reduce((s, p) => s + (p.amount_ugx || 0), 0);
  const lowStock = inventory.filter(i => i.current_stock <= i.safety_threshold).length;
  const vehiclesOnRoute = vehicles.filter(v => v.status === 'on_route').length;

  const recentPickups = [...pickups].sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).slice(0, 5);
  const dataCapped = [customers, pickups, payments, complaints, servicePoints].some(a => a.length >= ANALYTICS_SCAN_LIMIT);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-jakarta">
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {user?.full_name?.split(' ')[0] || 'there'} 👋
        </h1>
        <p className="text-muted-foreground mt-1">Here's what's happening today — {format(new Date(), 'EEEE, MMMM d yyyy')}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {role === 'super_admin' && (
          <StatCard title="Total Tenants" value={tenants.length} icon={Truck} color="bg-primary" sub={`${tenants.filter(t => t.status === 'active').length} active`} />
        )}
        <StatCard title="Customers" value={customers.length} icon={Users} color="bg-blue-500" sub={`${customers.filter(c => c.status === 'active').length} active`} />
        <StatCard title="Pending Pickups" value={pendingPickups} icon={Calendar} color="bg-amber-500" sub="awaiting assignment" />
        <StatCard title="Revenue (UGX)" value={totalRevenue.toLocaleString()} icon={CreditCard} color="bg-primary" sub="total collected" />
        <StatCard title="Open Complaints" value={openComplaints} icon={MessageSquare} color={openComplaints > 0 ? 'bg-red-500' : 'bg-green-500'} sub="need attention" />
        <StatCard title="Vehicles On Route" value={vehiclesOnRoute} icon={Truck} color="bg-blue-600" sub={`${vehicles.length} total`} />
        <StatCard title="Low Stock Items" value={lowStock} icon={Package} color={lowStock > 0 ? 'bg-orange-500' : 'bg-green-500'} sub="below threshold" />
        <StatCard title="Active Routes" value={routes.filter(r => r.status === 'published' || r.status === 'in_progress').length} icon={MapPin} color="bg-purple-500" sub="today" />
      </div>

      {/* Live Operational Map */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold font-jakarta flex items-center gap-2">
            <Map className="w-4 h-4 text-primary" /> Live Operational Map
            <Badge variant="secondary" className="text-xs ml-auto">
              {pickups.filter(p => p.status === 'in_progress').length} active · {vehicles.filter(v => v.status === 'on_route').length} vehicles on route
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-5">
          <Suspense fallback={<div className="h-80 rounded-xl bg-muted animate-pulse flex items-center justify-center text-muted-foreground text-sm">Loading map...</div>}>
            <DashboardMap
              servicePoints={servicePoints}
              pickups={pickups.filter(p => p.status !== 'cancelled')}
              vehicles={vehicles.filter(v => v.status !== 'retired')}
              routes={routes}
            />
          </Suspense>
        </CardContent>
      </Card>

      {/* Charts */}
      <div>
        <h2 className="font-semibold font-jakarta text-base mb-4">Performance Analytics</h2>
        {dataCapped && (
          <p className="text-xs text-muted-foreground mb-3">Based on the most recent {ANALYTICS_SCAN_LIMIT.toLocaleString()} records per dataset.</p>
        )}
        <DashboardCharts pickups={pickups} payments={payments} complaints={complaints} zones={zones} />
      </div>

      {/* Activity Feed */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold font-jakarta flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" /> Recent Pickup Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentPickups.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No pickup requests yet.</p>
            ) : (
              <div className="space-y-3">
                {recentPickups.map(p => (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{p.address || 'No address'}</p>
                      <p className="text-xs text-muted-foreground capitalize">{p.request_type?.replace('_', ' ')} · {p.waste_type}</p>
                    </div>
                    <Badge className={`text-xs ${statusColor[p.status] || ''}`} variant="secondary">
                      {p.status?.replace('_', ' ')}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold font-jakarta flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500" /> Open Complaints
            </CardTitle>
          </CardHeader>
          <CardContent>
            {complaints.filter(c => c.status === 'open').length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No open complaints. Great!</p>
            ) : (
              <div className="space-y-3">
                {complaints.filter(c => c.status === 'open').slice(0, 5).map(c => (
                  <div key={c.id} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{c.subject || c.category?.replace('_', ' ')}</p>
                      <p className="text-xs text-muted-foreground capitalize">{c.category?.replace('_', ' ')}</p>
                    </div>
                    <Badge variant="secondary" className={`text-xs ${c.priority === 'urgent' ? 'bg-red-100 text-red-700' : c.priority === 'high' ? 'bg-orange-100 text-orange-700' : 'bg-muted text-muted-foreground'}`}>
                      {c.priority}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}