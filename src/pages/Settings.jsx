import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  Users, MapPin, Truck, CreditCard, MessageSquare, Trash2,
  AlertTriangle, Save, Radio, Send, Shield, CheckCircle2,
  ChevronRight, Layers, Database, Activity, GitBranch, Inbox,
  Wifi, BarChart2, Recycle, BookOpen, UserCog,
  Plug, Globe, Gift
} from 'lucide-react';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';

const DELETION_PHRASE = 'I understand this will permanently delete all my data and cannot be undone';

// ── Section / module definitions ────────────────────────────────────────────
const SECTIONS = [
  {
    id: 'platform',
    label: 'Platform',
    icon: Layers,
    items: [
      { icon: Users,        label: 'Tenants',          desc: 'Multi-tenant waste management companies',           path: '/tenants',        status: 'active' },
      { icon: Users,        label: 'Customers',         desc: 'Residential & commercial customer management',      path: '/customers',       status: 'active' },
      { icon: UserCog,      label: 'User Management',   desc: 'Platform users, roles and access control',          path: '/users',           status: 'active' },
      { icon: MapPin,       label: 'Service Zones',     desc: 'District-level collection zone setup',              path: '/zones',           status: 'active' },
      { icon: Database,     label: 'Service Plans',     desc: 'Pricing tiers and billing configuration',           path: '/plans',           status: 'active' },
      { icon: Database,     label: 'Subscriptions',     desc: 'Customer plan subscriptions & renewals',            path: '/subscriptions',   status: 'active' },
    ],
  },
  {
    id: 'operations',
    label: 'Operations & Dispatch',
    icon: Radio,
    items: [
      { icon: Radio,        label: 'Dispatch Board',    desc: 'AI-assisted route building and job assignment',     path: '/dispatch',        status: 'active' },
      { icon: Truck,        label: 'Fleet & Maintenance', desc: 'Vehicle tracking, work orders & fuel logs',       path: '/fleet',           status: 'active' },
      { icon: Truck,        label: 'Driver App',        desc: 'Offline-first driver route & evidence capture',     path: '/driver-app',      status: 'active' },
      { icon: CreditCard,   label: 'Payments',          desc: 'Mobile money & cash payment tracking',              path: '/payments',        status: 'active' },
      { icon: MessageSquare,label: 'Complaints',        desc: 'Customer feedback and complaint resolution',         path: '/complaints',      status: 'active' },
      { icon: Send,         label: 'Communications',    desc: 'AI-assisted notifications & bulk messaging',        path: '/communications',  status: 'active' },
      { icon: CreditCard,   label: 'Customer Portal',   desc: 'Self-service invoices, pickup requests & history',  path: '/customer-app',    status: 'active' },
    ],
  },
  {
    id: 'integrations',
    label: 'Integrations & Data',
    icon: Plug,
    items: [
      { icon: Globe,        label: 'Integrations Hub',  desc: 'Connect third-party APIs and data sources',         path: '/integrations-hub',status: 'active' },
      { icon: Activity,     label: 'Integration Health',desc: 'Monitor connector status and sync health',           path: '/integration-health', status: 'active' },
      { icon: Inbox,        label: 'Integration Queue', desc: 'Review and retry queued integration payloads',       path: '/integration-queue', status: 'active' },
      { icon: GitBranch,    label: 'Sync Settings',     desc: 'Configure data sync rules and schedules',            path: '/sync-settings',   status: 'active' },
      { icon: Wifi,         label: 'Wialon Telemetry',  desc: 'Live fleet GPS tracking & telematics feed',          path: '/wialon',          status: 'coming_soon' },
      { icon: Database,     label: 'QuickBooks Sync',   desc: 'Automated accounting export & reconciliation',       path: null,               status: 'coming_soon' },
    ],
  },
  {
    id: 'admin',
    label: 'Admin & Compliance',
    icon: Shield,
    items: [
      { icon: Shield,       label: 'Audit Log',         desc: 'Immutable event log with AI risk scoring',           path: '/audit-logs',      status: 'active' },
      { icon: AlertTriangle,label: 'Exceptions Queue',  desc: 'Review and resolve flagged system exceptions',       path: '/exceptions',      status: 'active' },
      { icon: BarChart2,    label: 'Compliance Reports',desc: 'Regulatory and operational compliance reporting',     path: '/compliance',      status: 'active' },
      { icon: BookOpen,     label: 'Schema Evolution',  desc: 'Propose and review database schema changes',         path: '/schema-evolution',status: 'active' },
      { icon: Recycle,      label: 'CircularOS — Waste Bank', desc: 'Buy-back payouts, material grading & marketplace', path: '/waste-bank',  status: 'coming_soon' },
      { icon: Database,     label: 'USSD Gateway',      desc: 'Feature-phone access via USSD codes',                path: null,               status: 'coming_soon' },
    ],
  },
];

// ── Sub-panels ───────────────────────────────────────────────────────────────

function ProfilePanel({ user }) {
  const [phone, setPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await base44.auth.updateMe({ phone });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold font-jakarta">My Profile</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your personal details and preferences.</p>
      </div>

      {/* Identity */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Identity</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs mb-1.5 block">Full name</Label>
            <Input value={user?.full_name || ''} disabled className="text-sm bg-muted/40" />
          </div>
          <div>
            <Label className="text-xs mb-1.5 block">Email</Label>
            <Input value={user?.email || ''} disabled className="text-sm bg-muted/40" />
          </div>
          <div>
            <Label className="text-xs mb-1.5 block">Role</Label>
            <div className="flex items-center h-9">
              <Badge variant="secondary" className="capitalize">{user?.role || 'user'}</Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Contact */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Contact & Notifications</h3>
        <p className="text-xs text-muted-foreground">Your phone number is used for mobile money payments and SMS alerts.</p>
        <div className="flex gap-2 items-end max-w-sm">
          <div className="flex-1">
            <Label className="text-xs mb-1.5 block">Phone number</Label>
            <Input
              placeholder="+256 7XX XXX XXX"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="text-sm"
            />
          </div>
          <Button onClick={handleSave} disabled={saving || !phone} className="gap-1.5 shrink-0">
            {saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? 'Saved' : saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function LoyaltyConfigPanel({ user }) {
  const tenantId = user?.tenant_id;
  const [ugxPerPoint, setUgxPerPoint] = useState('');
  const [minRedeem, setMinRedeem] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (!tenantId) { setLoading(false); return; }
    base44.entities.Tenant.get(tenantId)
      .then(t => { if (!active) return; setUgxPerPoint(t?.loyalty_ugx_per_point ?? 10); setMinRedeem(t?.loyalty_min_redeem_points ?? 100); })
      .catch(() => { if (active) setError('Could not load loyalty settings.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [tenantId]);

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      await base44.entities.Tenant.update(tenantId, {
        loyalty_ugx_per_point: Math.max(0, Number(ugxPerPoint) || 0),
        loyalty_min_redeem_points: Math.max(0, Math.floor(Number(minRedeem) || 0)),
      });
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold font-jakarta">Loyalty</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Control how customers redeem loyalty points for wallet credit.</p>
      </div>

      {!tenantId ? (
        <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
          Loyalty settings are configured per tenant. Switch to a tenant account to edit them.
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Points redemption</h3>
          {loading ? (
            <div className="h-20 rounded-lg bg-muted animate-pulse" />
          ) : (
            <>
              <div className="grid sm:grid-cols-2 gap-4 max-w-lg">
                <div>
                  <Label className="text-xs mb-1.5 block">Wallet UGX per point</Label>
                  <Input type="number" min="0" value={ugxPerPoint} onChange={e => setUgxPerPoint(e.target.value)} className="text-sm" />
                  <p className="text-[11px] text-muted-foreground mt-1">Value credited per point on ad-hoc redemption.</p>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Minimum points to redeem</Label>
                  <Input type="number" min="0" value={minRedeem} onChange={e => setMinRedeem(e.target.value)} className="text-sm" />
                  <p className="text-[11px] text-muted-foreground mt-1">Smallest ad-hoc redemption allowed.</p>
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                {saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {saved ? 'Saved' : saving ? 'Saving…' : 'Save'}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ModulesPanel({ section }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold font-jakarta">{section.label}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {section.id === 'platform' && 'Core platform entities and user management.'}
          {section.id === 'operations' && 'Dispatch, fleet, payments and customer-facing modules.'}
          {section.id === 'integrations' && 'Third-party connectors, sync configuration and queue management.'}
          {section.id === 'admin' && 'Compliance, audit trails, exceptions and governance tools.'}
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {section.items.map(item => {
          const Icon = item.icon;
          const isActive = item.status === 'active';
          const inner = (
            <div className={cn(
              'group flex items-start gap-4 p-4 rounded-xl border transition-all',
              isActive && item.path
                ? 'border-border bg-card hover:border-primary/40 hover:shadow-sm cursor-pointer'
                : 'border-border/50 bg-muted/30 opacity-60'
            )}>
              <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold">{item.label}</span>
                  {!isActive && (
                    <Badge variant="secondary" className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0">Soon</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
              {isActive && item.path && (
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0 mt-1 transition-colors" />
              )}
            </div>
          );

          return isActive && item.path ? (
            <Link key={item.label} to={item.path}>{inner}</Link>
          ) : (
            <div key={item.label}>{inner}</div>
          );
        })}
      </div>
    </div>
  );
}

function DangerPanel({ user }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const customers = await base44.entities.Customer.filter({ email: user?.email });
      for (const customer of customers) {
        const id = customer.id;
        const [pickups, invoices, payments, complaints, servicePoints, subscriptions] = await Promise.all([
          base44.entities.PickupRequest.filter({ customer_id: id }),
          base44.entities.Invoice.filter({ customer_id: id }),
          base44.entities.Payment.filter({ customer_id: id }),
          base44.entities.Complaint.filter({ customer_id: id }),
          base44.entities.ServicePoint.filter({ customer_id: id }),
          base44.entities.Subscription.filter({ customer_id: id }),
        ]);
        await Promise.all([
          ...pickups.map(r => base44.entities.PickupRequest.delete(r.id)),
          ...invoices.map(r => base44.entities.Invoice.delete(r.id)),
          ...payments.map(r => base44.entities.Payment.delete(r.id)),
          ...complaints.map(r => base44.entities.Complaint.delete(r.id)),
          ...servicePoints.map(r => base44.entities.ServicePoint.delete(r.id)),
          ...subscriptions.map(r => base44.entities.Subscription.delete(r.id)),
        ]);
        await base44.entities.Customer.delete(id);
      }
    } finally {
      setIsDeleting(false);
      setOpen(false);
      base44.auth.logout('/');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold font-jakarta text-destructive">Danger Zone</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Irreversible actions — proceed with caution.</p>
      </div>

      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">Delete All My App Data</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Permanently deletes your customer profile, service points, pickup history, invoices, payments, complaints and subscriptions.
              Your login account remains active but all NLSWMS data will be gone forever.
            </p>
          </div>
        </div>
        <AlertDialog open={open} onOpenChange={v => { setOpen(v); if (!v) setConfirmText(''); }}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="gap-2">
              <Trash2 className="w-4 h-4" /> Delete My App Data
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-destructive flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" /> Permanently Delete All Data
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3 text-sm">
                  <p>This will <strong>permanently and irreversibly</strong> delete all records linked to your account.</p>
                  <p className="font-medium text-foreground">Your login account will remain, but the data cannot be recovered.</p>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Type the sentence below to confirm:</p>
                    <p className="text-xs font-medium bg-muted rounded-lg px-3 py-2 italic mb-2">"{DELETION_PHRASE}"</p>
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
              <Button variant="destructive" disabled={confirmText !== DELETION_PHRASE || isDeleting} onClick={handleDelete}>
                {isDeleting ? 'Deleting…' : 'Yes, Delete Everything'}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

// ── Nav items ─────────────────────────────────────────────────────────────────
const NAV = [
  { id: 'profile',       label: 'My Profile',              icon: UserCog },
  { id: 'loyalty',       label: 'Loyalty',                 icon: Gift },
  { id: 'platform',      label: 'Platform',                icon: Layers },
  { id: 'operations',    label: 'Operations & Dispatch',   icon: Radio },
  { id: 'integrations',  label: 'Integrations & Data',     icon: Plug },
  { id: 'admin',         label: 'Admin & Compliance',      icon: Shield },
  { id: 'danger',        label: 'Danger Zone',             icon: Trash2, danger: true },
];

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Settings() {
  const { user } = useAuth();
  const [active, setActive] = useState('profile');

  const activeSection = SECTIONS.find(s => s.id === active);

  return (
    <div className="flex h-full min-h-screen">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-border bg-muted/30 flex flex-col py-6 px-3 gap-1">
        <div className="px-3 mb-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Settings</p>
        </div>
        {NAV.map(n => {
          const Icon = n.icon;
          return (
            <button
              key={n.id}
              onClick={() => setActive(n.id)}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left w-full',
                active === n.id
                  ? n.danger
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-primary text-primary-foreground'
                  : n.danger
                    ? 'text-destructive/80 hover:bg-destructive/10'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{n.label}</span>
            </button>
          );
        })}
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-8 max-w-3xl">
        {active === 'profile' && <ProfilePanel user={user} />}
        {active === 'loyalty' && <LoyaltyConfigPanel user={user} />}
        {activeSection && <ModulesPanel section={activeSection} />}
        {active === 'danger' && <DangerPanel user={user} />}
      </main>
    </div>
  );
}