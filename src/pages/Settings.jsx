import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Settings as SettingsIcon, Database, Users, MapPin, Truck, CreditCard, MessageSquare } from 'lucide-react';

export default function Settings() {
  const modules = [
    { icon: Users, label: 'Tenants', desc: 'Multi-tenant waste management companies', status: 'active' },
    { icon: Users, label: 'Customers', desc: 'Residential & commercial customer management', status: 'active' },
    { icon: MapPin, label: 'Service Zones', desc: 'District-level collection zone setup', status: 'active' },
    { icon: Database, label: 'Service Plans', desc: 'Pricing tiers and billing configuration', status: 'active' },
    { icon: Database, label: 'Subscriptions', desc: 'Customer plan subscriptions & renewals', status: 'active' },
    { icon: Truck, label: 'Fleet', desc: 'Vehicle tracking and maintenance scheduling', status: 'active' },
    { icon: CreditCard, label: 'Payments', desc: 'Mobile money & cash payment tracking', status: 'active' },
    { icon: MessageSquare, label: 'Complaints', desc: 'Customer feedback and complaint resolution', status: 'active' },
    { icon: Users, label: 'Driver App', desc: 'Driver-facing mobile interface for route management', status: 'coming_soon' },
    { icon: Database, label: 'USSD Gateway', desc: 'Feature-phone access via USSD codes', status: 'coming_soon' },
    { icon: CreditCard, label: 'Mobile Money API', desc: 'Live MTN/Airtel payment gateway integration', status: 'coming_soon' },
    { icon: MapPin, label: 'Route Optimization', desc: 'AI-powered collection route planning', status: 'coming_soon' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-jakarta">Platform Settings</h1>
        <p className="text-sm text-muted-foreground">NLSWMS — Integrated Waste Management Platform</p>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {modules.map(m => (
          <Card key={m.label} className={m.status === 'coming_soon' ? 'opacity-60' : ''}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
                    <m.icon className="w-4 h-4 text-primary" />
                  </div>
                  <CardTitle className="text-sm">{m.label}</CardTitle>
                </div>
                <Badge className={m.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                  {m.status === 'active' ? 'Active' : 'Soon'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{m.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <SettingsIcon className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-sm">Sprint 1 — Complete</p>
              <p className="text-xs text-muted-foreground mt-1">
                All core modules scaffolded: Tenant management, Customer onboarding, Service zones, Plans, Subscriptions, Pickup requests, Payments, Complaints & Fleet.
                Sprint 2 will add the customer self-service portal, driver assignment workflows, and mobile money integration stubs.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}