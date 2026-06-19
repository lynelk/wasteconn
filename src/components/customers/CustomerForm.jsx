import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, Navigation } from 'lucide-react';
import DuplicateCheckBanner from '@/components/customers/DuplicateCheckBanner';
import MobileSelect from '@/components/ui/MobileSelect';

const UGANDA_DISTRICTS_OPTS = ['Kampala','Wakiso','Mukono','Jinja','Mbarara','Gulu','Lira','Arua','Fort Portal','Mbale','Soroti','Masaka'].map(d => ({ value: d, label: d }));



export default function CustomerForm({ customer, onClose }) {
  const qc = useQueryClient();
  const { data: zones = [] } = useQuery({ queryKey: ['zones'], queryFn: () => base44.entities.ServiceZone.list() });
  const { data: tenants = [] } = useQuery({ queryKey: ['tenants'], queryFn: () => base44.entities.Tenant.list() });
  // Only institution customers can be a parent — fetch just those (bounded)
  // rather than the entire customer table.
  const { data: institutions = [] } = useQuery({
    queryKey: ['customers', 'institutions'],
    queryFn: () => base44.entities.Customer.filter({ customer_segment: 'institution' }, 'full_name', 500),
  });

  const [form, setForm] = useState({
    full_name: customer?.full_name || '',
    phone: customer?.phone || '',
    email: customer?.email || '',
    customer_type: customer?.customer_type || 'residential',
    customer_segment: customer?.customer_segment || 'individual',
    customer_tier: customer?.customer_tier || 'basic',
    address: customer?.address || '',
    latitude: customer?.latitude || '',
    longitude: customer?.longitude || '',
    district: customer?.district || '',
    zone_id: customer?.zone_id || '',
    tenant_id: customer?.tenant_id || (tenants[0]?.id || ''),
    status: customer?.status || 'active',
    mobile_money_number: customer?.mobile_money_number || '',
    mobile_money_provider: customer?.mobile_money_provider || 'none',
    preferred_language: customer?.preferred_language || 'english',
    institution_name: customer?.institution_name || '',
    contact_person: customer?.contact_person || '',
    num_branches: customer?.num_branches || 1,
    parent_customer_id: customer?.parent_customer_id || '',
    is_branch: customer?.is_branch || false,
    bin_count: customer?.bin_count || 1,
    estimated_waste_kg_month: customer?.estimated_waste_kg_month || '',
    onboarding_source: customer?.onboarding_source || 'manual',
    notes: customer?.notes || '',
  });

  const [aiTierLoading, setAiTierLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const segment = form.customer_segment;
  const parentCandidates = institutions.filter(c => c.id !== customer?.id);

  // Auto-classify tier based on profile signals
  const classifyTier = () => {
    let tier = 'basic';
    if (segment === 'institution' || form.num_branches > 3 || (parseFloat(form.estimated_waste_kg_month) || 0) > 500) tier = 'enterprise';
    else if (segment === 'sme' || form.customer_type === 'commercial' || (parseFloat(form.estimated_waste_kg_month) || 0) > 200) tier = 'premium';
    else if (form.bin_count > 2 || (parseFloat(form.estimated_waste_kg_month) || 0) > 100) tier = 'standard';
    set('customer_tier', tier);
  };

  const captureGPS = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => setForm(f => ({ ...f, latitude: pos.coords.latitude, longitude: pos.coords.longitude })),
      () => {},
      { enableHighAccuracy: true }
    );
  };

  const mutation = useMutation({
    mutationFn: () => customer
      ? base44.entities.Customer.update(customer.id, form)
      : base44.entities.Customer.create({ ...form, tier_auto_classified: false }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); onClose(); },
  });

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      {/* Segment Selector */}
      {!customer && (
        <Tabs value={segment} onValueChange={v => {
          set('customer_segment', v);
          if (v === 'individual') set('customer_type', 'residential');
          else if (v === 'sme') set('customer_type', 'commercial');
          else if (v === 'institution') set('customer_type', 'industrial');
        }}>
          <TabsList className="w-full">
            <TabsTrigger value="individual" className="flex-1">Individual</TabsTrigger>
            <TabsTrigger value="sme" className="flex-1">SME</TabsTrigger>
            <TabsTrigger value="institution" className="flex-1">Institution</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {!customer && (
        <DuplicateCheckBanner fullName={form.full_name} phone={form.phone} email={form.email} />
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Institution-specific fields */}
        {(segment === 'institution' || segment === 'sme') && (
          <>
            <div className="col-span-2 space-y-1.5">
              <Label>{segment === 'institution' ? 'Organisation Name' : 'Business Name'} *</Label>
              <Input value={form.institution_name} onChange={e => set('institution_name', e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Contact Person</Label>
              <Input value={form.contact_person} onChange={e => set('contact_person', e.target.value)} />
            </div>
          </>
        )}

        <div className={segment === 'individual' ? 'col-span-2 space-y-1.5' : 'space-y-1.5'}>
          <Label>Full Name *</Label>
          <Input value={form.full_name} onChange={e => set('full_name', e.target.value)} />
        </div>

        {segment === 'institution' && (
          <div className="space-y-1.5">
            <Label>Number of Branches</Label>
            <Input type="number" min={1} value={form.num_branches} onChange={e => set('num_branches', parseInt(e.target.value) || 1)} />
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Phone *</Label>
          <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+256..." />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label>Customer Type</Label>
          <MobileSelect value={form.customer_type} onChange={v => set('customer_type', v)} options={[{value:'residential',label:'Residential'},{value:'commercial',label:'Commercial'},{value:'industrial',label:'Industrial'}]} />
        </div>

        <div className="space-y-1.5">
          <Label>District</Label>
          <MobileSelect value={form.district} onChange={v => set('district', v)} options={UGANDA_DISTRICTS_OPTS} placeholder="Select district" />
        </div>

        <div className="col-span-2 space-y-1.5">
          <Label>Address</Label>
          <Input value={form.address} onChange={e => set('address', e.target.value)} />
        </div>

        {/* GPS Capture */}
        <div className="col-span-2 bg-secondary/30 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">GPS Coordinates</Label>
            <Button variant="ghost" size="sm" onClick={captureGPS} className="text-xs gap-1 h-6">
              <Navigation className="w-3 h-3" /> Auto-Capture
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input type="number" step="any" placeholder="Latitude" value={form.latitude} onChange={e => set('latitude', parseFloat(e.target.value) || '')} />
            <Input type="number" step="any" placeholder="Longitude" value={form.longitude} onChange={e => set('longitude', parseFloat(e.target.value) || '')} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Service Zone</Label>
          <MobileSelect value={form.zone_id} onChange={v => set('zone_id', v)} options={zones.map(z => ({ value: z.id, label: z.zone_name }))} placeholder="Assign zone" />
        </div>

        <div className="space-y-1.5">
          <Label>Status</Label>
          <MobileSelect value={form.status} onChange={v => set('status', v)} options={[{value:'active',label:'Active'},{value:'inactive',label:'Inactive'},{value:'suspended',label:'Suspended'}]} />
        </div>

        {/* Volume & tier */}
        <div className="space-y-1.5">
          <Label>Bin Count</Label>
          <Input type="number" min={1} value={form.bin_count} onChange={e => set('bin_count', parseInt(e.target.value) || 1)} />
        </div>
        <div className="space-y-1.5">
          <Label>Est. Waste (kg/month)</Label>
          <Input type="number" value={form.estimated_waste_kg_month} onChange={e => set('estimated_waste_kg_month', parseFloat(e.target.value) || '')} placeholder="0" />
        </div>

        <div className="col-span-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>Customer Tier</Label>
            <Button variant="ghost" size="sm" onClick={classifyTier} className="text-xs gap-1 h-6 text-primary">
              <Sparkles className="w-3 h-3" /> Auto-Classify
            </Button>
          </div>
          <MobileSelect value={form.customer_tier} onChange={v => set('customer_tier', v)} options={[{value:'basic',label:'Basic'},{value:'standard',label:'Standard'},{value:'premium',label:'Premium'},{value:'enterprise',label:'Enterprise'}]} />
        </div>

        {/* Branch linking for institutions */}
        {segment === 'institution' && (
          <div className="col-span-2 space-y-1.5">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isBranch" checked={form.is_branch} onChange={e => set('is_branch', e.target.checked)} className="rounded" />
              <Label htmlFor="isBranch" className="text-sm">This is a branch of an existing institution</Label>
            </div>
            {form.is_branch && (
              <MobileSelect value={form.parent_customer_id} onChange={v => set('parent_customer_id', v)} options={parentCandidates.map(c => ({ value: c.id, label: c.institution_name || c.full_name }))} placeholder="Select parent institution…" />
            )}
          </div>
        )}

        {/* Payment */}
        <div className="space-y-1.5">
          <Label>Mobile Money Provider</Label>
          <MobileSelect value={form.mobile_money_provider} onChange={v => set('mobile_money_provider', v)} options={[{value:'none',label:'None'},{value:'mtn',label:'MTN MoMo'},{value:'airtel',label:'Airtel Money'}]} />
        </div>
        <div className="space-y-1.5">
          <Label>Mobile Money Number</Label>
          <Input value={form.mobile_money_number} onChange={e => set('mobile_money_number', e.target.value)} placeholder="+256..." />
        </div>

        <div className="space-y-1.5">
          <Label>Preferred Language</Label>
          <MobileSelect value={form.preferred_language} onChange={v => set('preferred_language', v)} options={[{value:'english',label:'English'},{value:'luganda',label:'Luganda'},{value:'swahili',label:'Swahili'}]} />
        </div>

        <div className="col-span-2 space-y-1.5">
          <Label>Notes</Label>
          <Textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.full_name || !form.phone}>
          {mutation.isPending ? 'Saving...' : customer ? 'Save Changes' : 'Register Customer'}
        </Button>
      </div>
    </div>
  );
}