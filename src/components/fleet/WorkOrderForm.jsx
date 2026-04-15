import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function WorkOrderForm({ workOrder, vehicles, onClose, onSaved }) {
  const [form, setForm] = useState(workOrder || {
    vehicle_id: '', order_type: 'corrective', title: '', description: '',
    priority: 'medium', scheduled_date: '', assigned_technician: '', cost_ugx: '', notes: '',
  });

  const mutation = useMutation({
    mutationFn: (data) => workOrder
      ? base44.entities.MaintenanceWorkOrder.update(workOrder.id, data)
      : base44.entities.MaintenanceWorkOrder.create({ ...data, status: 'open', tenant_id: '' }),
    onSuccess: onSaved,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold font-jakarta">{workOrder ? 'Edit' : 'New'} Work Order</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <div className="space-y-3">
          {[
            { label: 'Title', key: 'title', type: 'text', required: true },
            { label: 'Assigned Technician', key: 'assigned_technician', type: 'text' },
            { label: 'Scheduled Date', key: 'scheduled_date', type: 'date' },
            { label: 'Cost (UGX)', key: 'cost_ugx', type: 'number' },
          ].map(f => (
            <div key={f.key}>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{f.label}</label>
              <input type={f.type} className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background"
                value={form[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
            </div>
          ))}
          {[
            { label: 'Vehicle', key: 'vehicle_id', options: vehicles.map(v => ({ value: v.id, label: v.registration_number })) },
            { label: 'Order Type', key: 'order_type', options: ['preventive','corrective','predictive','emergency'].map(v => ({ value: v, label: v })) },
            { label: 'Priority', key: 'priority', options: ['low','medium','high','critical'].map(v => ({ value: v, label: v })) },
          ].map(f => (
            <div key={f.key}>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{f.label}</label>
              <select className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background"
                value={form[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}>
                <option value="">Select...</option>
                {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          ))}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
            <textarea className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background resize-none" rows={3}
              value={form.description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={() => mutation.mutate(form)} disabled={mutation.isPending || !form.title}>
              {mutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}