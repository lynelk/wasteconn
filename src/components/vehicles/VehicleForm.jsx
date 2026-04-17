import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import MobileSelect from '@/components/ui/MobileSelect';

export default function VehicleForm({ vehicle, onClose }) {
  const qc = useQueryClient();
  const { data: tenants = [] } = useQuery({ queryKey: ['tenants'], queryFn: () => base44.entities.Tenant.list() });

  const [form, setForm] = useState({
    registration_number: vehicle?.registration_number || '',
    vehicle_type: vehicle?.vehicle_type || 'truck',
    make_model: vehicle?.make_model || '',
    year: vehicle?.year || '',
    capacity_tonnes: vehicle?.capacity_tonnes || '',
    fuel_type: vehicle?.fuel_type || 'diesel',
    status: vehicle?.status || 'available',
    tenant_id: vehicle?.tenant_id || (tenants[0]?.id || ''),
    last_service_date: vehicle?.last_service_date || '',
    next_service_date: vehicle?.next_service_date || '',
    notes: vehicle?.notes || '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: () => vehicle
      ? base44.entities.Vehicle.update(vehicle.id, form)
      : base44.entities.Vehicle.create(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicles'] }); onClose(); },
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Registration No. *</Label>
          <Input value={form.registration_number} onChange={e => set('registration_number', e.target.value)} placeholder="e.g. UAX 123B" />
        </div>
        <div className="space-y-1.5">
          <Label>Vehicle Type</Label>
          <MobileSelect value={form.vehicle_type} onChange={v => set('vehicle_type', v)} options={[{value:'truck',label:'Truck'},{value:'tipper',label:'Tipper'},{value:'compactor',label:'Compactor'},{value:'pickup',label:'Pickup'},{value:'tricycle',label:'Tricycle'}]} />
        </div>
        <div className="space-y-1.5">
          <Label>Make / Model</Label>
          <Input value={form.make_model} onChange={e => set('make_model', e.target.value)} placeholder="e.g. Isuzu FRR" />
        </div>
        <div className="space-y-1.5">
          <Label>Year</Label>
          <Input type="number" value={form.year} onChange={e => set('year', Number(e.target.value))} placeholder="e.g. 2020" />
        </div>
        <div className="space-y-1.5">
          <Label>Capacity (tonnes)</Label>
          <Input type="number" value={form.capacity_tonnes} onChange={e => set('capacity_tonnes', Number(e.target.value))} />
        </div>
        <div className="space-y-1.5">
          <Label>Fuel Type</Label>
          <MobileSelect value={form.fuel_type} onChange={v => set('fuel_type', v)} options={[{value:'diesel',label:'Diesel'},{value:'petrol',label:'Petrol'},{value:'electric',label:'Electric'}]} />
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <MobileSelect value={form.status} onChange={v => set('status', v)} options={[{value:'available',label:'Available'},{value:'on_route',label:'On Route'},{value:'maintenance',label:'Maintenance'},{value:'retired',label:'Retired'}]} />
        </div>
        <div className="space-y-1.5">
          <Label>Last Service Date</Label>
          <Input type="date" value={form.last_service_date} onChange={e => set('last_service_date', e.target.value)} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Next Service Date</Label>
          <Input type="date" value={form.next_service_date} onChange={e => set('next_service_date', e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.registration_number}>
          {mutation.isPending ? 'Saving...' : vehicle ? 'Save Changes' : 'Add Vehicle'}
        </Button>
      </div>
    </div>
  );
}