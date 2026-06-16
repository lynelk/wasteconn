import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Settings as SettingsIcon, Database, Users, MapPin, Truck,
  CreditCard, MessageSquare, Trash2, AlertTriangle, Phone, Save,
  Radio, Send, Shield, CheckCircle2
} from 'lucide-react';
import UserManagement from '@/components/settings/UserManagement';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';

const DELETION_PHRASE = 'I understand this will permanently delete all my data and cannot be undone';

export default function Settings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [phone, setPhone] = useState(user?.phone || '');
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneSaved, setPhoneSaved] = useState(false);

  const handleSavePhone = async () => {
    setSavingPhone(true);
    await base44.auth.updateMe({ phone });
    setSavingPhone(false);
    setPhoneSaved(true);
    setTimeout(() => setPhoneSaved(false), 2500);
  };

  const handleDeleteAllData = async () => {
    setIsDeleting(true);
    try {
      // Find customer record linked to this user
      const customers = await base44.entities.Customer.filter({ email: user?.email });
      for (const customer of customers) {
        const customerId = customer.id;
        // Delete all linked data in parallel
        const [pickups, invoices, payments, complaints, servicePoints, subscriptions] = await Promise.all([
          base44.entities.PickupRequest.filter({ customer_id: customerId }),
          base44.entities.Invoice.filter({ customer_id: customerId }),
          base44.entities.Payment.filter({ customer_id: customerId }),
          base44.entities.Complaint.filter({ customer_id: customerId }),
          base44.entities.ServicePoint.filter({ customer_id: customerId }),
          base44.entities.Subscription.filter({ customer_id: customerId }),
        ]);
        await Promise.all([
          ...pickups.map(r => base44.entities.PickupRequest.delete(r.id)),
          ...invoices.map(r => base44.entities.Invoice.delete(r.id)),
          ...payments.map(r => base44.entities.Payment.delete(r.id)),
          ...complaints.map(r => base44.entities.Complaint.delete(r.id)),
          ...servicePoints.map(r => base44.entities.ServicePoint.delete(r.id)),
          ...subscriptions.map(r => base44.entities.Subscription.delete(r.id)),
        ]);
        await base44.entities.Customer.delete(customerId);
      }
    } finally {
      setIsDeleting(false);
      setDeleteConfirmOpen(false);
      base44.auth.logout('/');
    }
  };

  const modules = [
    { icon: Users, label: 'Tenants', desc: 'Multi-tenant waste management companies', status: 'active' },
    { icon: Users, label: 'Customers', desc: 'Residential & commercial customer management', status: 'active' },
    { icon: MapPin, label: 'Service Zones', desc: 'District-level collection zone setup', status: 'active' },
    { icon: Database, label: 'Service Plans', desc: 'Pricing tiers and billing configuration', status: 'active' },
    { icon: Database, label: 'Subscriptions', desc: 'Customer plan subscriptions & renewals', status: 'active' },
    { icon: Truck, label: 'Fleet & Maintenance', desc: 'Vehicle tracking, work orders & fuel logs', status: 'active' },
    { icon: CreditCard, label: 'Payments', desc: 'Mobile money & cash payment tracking', status: 'active' },
    { icon: MessageSquare, label: 'Complaints', desc: 'Customer feedback and complaint resolution', status: 'active' },
    { icon: Radio, label: 'Dispatch Board', desc: 'AI-assisted route building and job assignment', status: 'active' },
    { icon: Truck, label: 'Driver App', desc: 'Offline-first driver route & evidence capture', status: 'active' },
    { icon: CreditCard, label: 'Customer Portal', desc: 'Self-service invoices, pickup requests & history', status: 'active' },
    { icon: Shield, label: 'Audit Log', desc: 'Immutable log with AI risk scoring', status: 'active' },
    { icon: Send, label: 'Communications', desc: 'AI-assisted notifications & bulk messaging', status: 'active' },
    { icon: Database, label: 'USSD Gateway', desc: 'Feature-phone access via USSD codes', status: 'coming_soon' },
    { icon: CreditCard, label: 'Mobile Money API', desc: 'Live MTN/Airtel payment gateway integration', status: 'coming_soon' },
    { icon: MapPin, label: 'Wialon Telemetry', desc: 'Live fleet GPS tracking & telematics feed', status: 'coming_soon' },
    { icon: Database, label: 'CircularOS — Waste Bank', desc: 'Buy-back payouts, material grading & marketplace', status: 'coming_soon' },
    { icon: Database, label: 'QuickBooks Sync', desc: 'Automated accounting export & reconciliation', status: 'coming_soon' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold font-jakarta">Platform Settings</h1>
        <p className="text-sm text-muted-foreground">NLSWMS — Integrated Waste Management Platform</p>
      </div>

      {/* Profile — Phone Number */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Phone className="w-4 h-4 text-primary" /> Phone Number
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Store your phone number for mobile money payments and SMS notifications.
          </p>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label className="text-xs mb-1.5 block">Phone number</Label>
              <Input
                placeholder="+256 7XX XXX XXX"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="text-sm"
              />
            </div>
            <Button onClick={handleSavePhone} disabled={savingPhone || !phone} className="gap-1.5 shrink-0">
              {phoneSaved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {phoneSaved ? 'Saved' : savingPhone ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Module Grid */}
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

      {/* User Management */}
      <UserManagement />

      {/* Sprint Progress */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <SettingsIcon className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-sm">Sprints 1–4 — Complete</p>
              <p className="text-xs text-muted-foreground mt-1">
                Foundation (multi-tenancy, RBAC, audit log), customer onboarding & scheduling, dispatch & driver app with offline-first evidence capture, and invoicing & communications are all live.
                Sprint 5 will add CityOS zoning analytics, the omni-inbox ticketing system, and Wialon telemetry integration.
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
            Permanently deletes <strong>all your data</strong> from this application — including your customer profile,
            service points, pickup history, invoices, payments, complaints, and subscriptions.
            Your login account remains active but all EcoTrack app data will be gone forever.
          </p>
          <AlertDialog open={deleteConfirmOpen} onOpenChange={(open) => { setDeleteConfirmOpen(open); if (!open) setConfirmText(''); }}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="gap-2">
                <Trash2 className="w-4 h-4" />
                Delete My App Data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-destructive flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" /> Permanently Delete All Data
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3 text-sm">
                    <p>This will <strong>permanently and irreversibly</strong> delete:</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground text-xs ml-1">
                      <li>Your customer profile and account details</li>
                      <li>All service points linked to your account</li>
                      <li>All pickup requests and collection history</li>
                      <li>All invoices and payment records</li>
                      <li>All complaints and support tickets</li>
                      <li>All active or past subscriptions</li>
                    </ul>
                    <p className="font-medium text-foreground">Your login account will remain, but this data cannot be recovered.</p>
                    <div className="pt-1">
                      <p className="text-xs text-muted-foreground mb-2">
                        To confirm, type the sentence below exactly:
                      </p>
                      <p className="text-xs font-medium bg-muted rounded-lg px-3 py-2 text-foreground italic mb-2">
                        "{DELETION_PHRASE}"
                      </p>
                      <Input
                        value={confirmText}
                        onChange={e => setConfirmText(e.target.value)}
                        placeholder="Type the confirmation sentence…"
                        className="text-xs"
                      />
                    </div>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <Button
                  variant="destructive"
                  disabled={confirmText !== DELETION_PHRASE || isDeleting}
                  onClick={handleDeleteAllData}
                >
                  {isDeleting ? 'Deleting…' : 'Yes, Delete Everything'}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}