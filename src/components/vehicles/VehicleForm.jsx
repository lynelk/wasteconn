import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
          <Select value={form.vehicle_type} onValueChange={v => set('vehicle_type', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="truck">Truck</SelectItem>
              <SelectItem value="tipper">Tipper</SelectItem>
              <SelectItem value="compactor">Compactor</SelectItem>
              <SelectItem value="pickup">Pickup</SelectItem>
              <SelectItem value="tricycle">Tricycle</SelectItem>
            </SelectContent>
          </Select>
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
          <Select value={form.fuel_type} onValueChange={v => set('fuel_type', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="diesel">Diesel</SelectItem>
              <SelectItem value="petrol">Petrol</SelectItem>
              <SelectItem value="electric">Electric</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={v => set('status', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="on_route">On Route</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="retired">Retired</SelectItem>
            </SelectContent>
          </Select>
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