import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Settings as SettingsIcon, Database, Users, MapPin, Truck, CreditCard, MessageSquare, Trash2, AlertTriangle } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { base44 } from '@/api/base44Client';

export default function Settings() {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const handleDeleteAccount = async () => {
    await base44.auth.logout('/');
  };

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

      {/* Danger Zone */}
      <Card className="border-destructive/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-destructive flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
          <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="gap-2">
                <Trash2 className="w-4 h-4" />
                Delete Account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete your account and remove all your data from the platform. This action <strong>cannot be undone</strong>.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Yes, Delete My Account
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}