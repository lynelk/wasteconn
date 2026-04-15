import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, ClipboardList, CreditCard, MessageSquare, Truck, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState({ customers: 0, pickups: 0, payments: 0, complaints: 0, tenants: 0, vehicles: 0 });
  const [recentPickups, setRecentPickups] = useState([]);
  const [recentComplaints, setRecentComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [customers, pickups, payments, complaints, tenants, vehicles] = await Promise.all([
        base44.entities.Customer.list(),
        base44.entities.PickupRequest.list('-created_date', 5),
        base44.entities.Payment.list(),
        base44.entities.Complaint.list('-created_date', 5),
        base44.entities.Tenant.list(),
        base44.entities.Vehicle.list(),
      ]);
      setStats({
        customers: customers.length,
        pickups: pickups.length,
        payments: payments.reduce((s, p) => s + (p.amount_ugx || 0), 0),
        complaints: complaints.filter(c => c.status === 'open').length,
        tenants: tenants.length,
        vehicles: vehicles.length,
      });
      setRecentPickups(pickups.slice(0, 5));
      setRecentComplaints(complaints.filter(c => c.status === 'open').slice(0, 5));
      setLoading(false);
    }
    load();
  }, []);

  const statCards = [
    { label: 'Total Customers', value: stats.customers, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', link: '/customers' },
    { label: 'Pickup Requests', value: stats.pickups, icon: ClipboardList, color: 'text-primary', bg: 'bg-secondary', link: '/pickups' },
    { label: 'Revenue (UGX)', value: `${(stats.payments / 1000).toFixed(0)}K`, icon: CreditCard, color: 'text-yellow-600', bg: 'bg-yellow-50', link: '/payments' },
    { label: 'Open Complaints', value: stats.complaints, icon: MessageSquare, color: 'text-red-500', bg: 'bg-red-50', link: '/complaints' },
    { label: 'Active Tenants', value: stats.tenants, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50', link: '/tenants' },
    { label: 'Fleet Vehicles', value: stats.vehicles, icon: Truck, color: 'text-indigo-600', bg: 'bg-indigo-50', link: '/fleet' },
  ];

  const statusColor = { pending: 'bg-yellow-100 text-yellow-800', assigned: 'bg-blue-100 text-blue-800', in_progress: 'bg-indigo-100 text-indigo-800', completed: 'bg-green-100 text-green-800', cancelled: 'bg-red-100 text-red-800' };
  const priorityColor = { low: 'bg-gray-100 text-gray-700', medium: 'bg-yellow-100 text-yellow-800', high: 'bg-orange-100 text-orange-800', urgent: 'bg-red-100 text-red-800' };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-jakarta">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Welcome back. Here's what's happening today.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map(s => (
          <Link key={s.label} to={s.link}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                </div>
                <p className="text-2xl font-bold font-jakarta">{loading ? '—' : s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent Pickups */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">Recent Pickup Requests</CardTitle>
            <Link to="/pickups"><Button variant="ghost" size="sm" className="text-xs">View all</Button></Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentPickups.length === 0 && !loading && <p className="text-sm text-muted-foreground text-center py-4">No pickups yet</p>}
            {recentPickups.map(p => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">{p.request_type?.replace('_', ' ')} — {p.waste_type}</p>
                  <p className="text-xs text-muted-foreground">{p.scheduled_date || 'No date set'}</p>
                </div>
                <Badge className={statusColor[p.status] || 'bg-gray-100'}>{p.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Open Complaints */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">Open Complaints</CardTitle>
            <Link to="/complaints"><Button variant="ghost" size="sm" className="text-xs">View all</Button></Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentComplaints.length === 0 && !loading && (
              <div className="flex items-center gap-2 py-4 justify-center text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm">No open complaints</span>
              </div>
            )}
            {recentComplaints.map(c => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">{c.subject || c.category?.replace('_', ' ')}</p>
                  <p className="text-xs text-muted-foreground capitalize">{c.category?.replace('_', ' ')}</p>
                </div>
                <Badge className={priorityColor[c.priority] || 'bg-gray-100'}>{c.priority}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}