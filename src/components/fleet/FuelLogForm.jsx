import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

export default function FuelLogForm({ vehicles, onClose, onSaved }) {
  const [form, setForm] = useState({
    vehicle_id: '', fuel_date: format(new Date(), 'yyyy-MM-dd'),
    litres: '', cost_ugx: '', odometer_km: '', station_name: '', fuel_type: 'diesel', notes: '',
  });

  const mutation = useMutation({
    mutationFn: (data) => base44.entities.FuelLog.create({
      ...data,
      tenant_id: '',
      efficiency_km_per_litre: data.odometer_km && data.litres ? (parseFloat(data.odometer_km) / parseFloat(data.litres)).toFixed(2) : null,
    }),
    onSuccess: onSaved,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold font-jakarta">Log Fuel Purchase</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Vehicle</label>
            <select className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background"
              value={form.vehicle_id} onChange={e => setForm(p => ({ ...p, vehicle_id: e.target.value }))}>
              <option value="">Select vehicle...</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.registration_number}</option>)}
            </select>
          </div>
          {[
            { label: 'Date', key: 'fuel_date', type: 'date' },
            { label: 'Litres', key: 'litres', type: 'number' },
            { label: 'Cost (UGX)', key: 'cost_ugx', type: 'number' },
            { label: 'Odometer (km)', key: 'odometer_km', type: 'number' },
            { label: 'Station Name', key: 'station_name', type: 'text' },
          ].map(f => (
            <div key={f.key}>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{f.label}</label>
              <input type={f.type} className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background"
                value={form[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={() => mutation.mutate(form)} disabled={mutation.isPending || !form.vehicle_id || !form.litres}>
              {mutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}