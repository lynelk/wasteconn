import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Radio, Map, TrendingUp } from 'lucide-react';
import CitoReportExport from '@/components/analytics/CitoReportExport';
import WialonIntegration from '@/pages/WialonIntegration';
import CoverageAnalytics from '@/pages/CoverageAnalytics';
import HistoricalTrendWidget from '@/components/analytics/HistoricalTrendWidget';

const COLORS = ['hsl(152,60%,32%)', 'hsl(38,92%,50%)', 'hsl(210,70%,50%)', 'hsl(0,84%,60%)', 'hsl(280,65%,60%)'];

export default function Analytics() {
  const { data: payments = [] } = useQuery({ queryKey: ['payments'], queryFn: () => base44.entities.Payment.list() });
  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: () => base44.entities.Customer.list() });
  const { data: pickups = [] } = useQuery({ queryKey: ['pickups'], queryFn: () => base44.entities.PickupRequest.list() });
  const { data: complaints = [] } = useQuery({ queryKey: ['complaints'], queryFn: () => base44.entities.Complaint.list() });

  // Revenue by method
  const revenueByMethod = ['cash','mtn_momo','airtel_money','bank_transfer'].map(m => ({
    name: m.replace('_',' ').toUpperCase(),
    value: payments.filter(p=>p.payment_method===m&&p.status==='completed').reduce((s,p)=>s+(p.amount_ugx||0),0)
  })).filter(d => d.value > 0);

  // Customer type breakdown
  const customerTypes = ['residential','commercial','industrial'].map(t => ({
    name: t.charAt(0).toUpperCase()+t.slice(1),
    value: customers.filter(c=>c.customer_type===t).length
  })).filter(d=>d.value>0);

  // Pickup status breakdown
  const pickupStatuses = ['pending','assigned','in_progress','completed','cancelled'].map(s => ({
    name: s.replace('_',' '),
    count: pickups.filter(p=>p.status===s).length
  })).filter(d=>d.count>0);

  // Complaint categories
  const complaintCats = ['missed_collection','driver_behaviour','billing','service_quality','other'].map(c => ({
    name: c.replace('_',' '),
    count: complaints.filter(x=>x.category===c).length
  })).filter(d=>d.count>0);

  const totalRevenue = payments.filter(p=>p.status==='completed').reduce((s,p)=>s+(p.amount_ugx||0),0);
  const completionRate = pickups.length > 0 ? Math.round(pickups.filter(p=>p.status==='completed').length / pickups.length * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-jakarta">Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">Platform performance overview</p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="citoconnect">CitoConnect Reports</TabsTrigger>
          <TabsTrigger value="coverage"><Map className="w-3.5 h-3.5 mr-1" />Coverage</TabsTrigger>
          <TabsTrigger value="wialon"><Radio className="w-3.5 h-3.5 mr-1" />Telematics</TabsTrigger>
          <TabsTrigger value="trends"><TrendingUp className="w-3.5 h-3.5 mr-1" />Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/60"><CardContent className="pt-5">
          <p className="text-xs text-muted-foreground">Total Revenue</p>
          <p className="text-2xl font-bold font-jakarta text-primary mt-1">{totalRevenue.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">UGX collected</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="pt-5">
          <p className="text-xs text-muted-foreground">Customers</p>
          <p className="text-2xl font-bold font-jakarta mt-1">{customers.length}</p>
          <p className="text-xs text-muted-foreground">{customers.filter(c=>c.status==='active').length} active</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="pt-5">
          <p className="text-xs text-muted-foreground">Pickup Rate</p>
          <p className="text-2xl font-bold font-jakarta mt-1">{completionRate}%</p>
          <p className="text-xs text-muted-foreground">completion rate</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="pt-5">
          <p className="text-xs text-muted-foreground">Open Complaints</p>
          <p className="text-2xl font-bold font-jakarta mt-1">{complaints.filter(c=>c.status==='open').length}</p>
          <p className="text-xs text-muted-foreground">need attention</p>
        </CardContent></Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-border/60">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold font-jakarta">Revenue by Payment Method</CardTitle></CardHeader>
          <CardContent>
            {revenueByMethod.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No payment data yet</p> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={revenueByMethod}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                  <Tooltip formatter={v => [`${v.toLocaleString()} UGX`]} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold font-jakarta">Customer Types</CardTitle></CardHeader>
          <CardContent>
            {customerTypes.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No customer data yet</p> : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={customerTypes} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({name,value})=>`${name}: ${value}`} labelLine={false}>
                    {customerTypes.map((_,i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold font-jakarta">Pickup Request Status</CardTitle></CardHeader>
          <CardContent>
            {pickupStatuses.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No pickup data yet</p> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={pickupStatuses} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(38,92%,50%)" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold font-jakarta">Complaint Categories</CardTitle></CardHeader>
          <CardContent>
            {complaintCats.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No complaint data yet</p> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={complaintCats} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(0,84%,60%)" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
        </TabsContent>

        <TabsContent value="citoconnect" className="mt-4">
          <CitoReportExport />
        </TabsContent>

        <TabsContent value="coverage" className="mt-4">
          <CoverageAnalytics />
        </TabsContent>

        <TabsContent value="wialon" className="mt-4">
          <WialonIntegration />
        </TabsContent>

        <TabsContent value="trends" className="mt-4">
          <HistoricalTrendWidget />
        </TabsContent>
      </Tabs>
    </div>
  );
}