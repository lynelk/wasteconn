import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function RouteBuilder({ jobs, vehicles, zones, selectedDate, onClose, onSaved }) {
  const [form, setForm] = useState({
    route_name: `Route ${selectedDate}`,
    vehicle_id: '',
    driver_id: '',
    zone_id: jobs[0]?.zone_id || '',
    estimated_distance_km: '',
    notes: '',
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const route = await base44.entities.Route.create({
        ...data,
        route_date: selectedDate,
        job_ids: jobs.map(j => j.id),
        status: 'published',
        tenant_id: jobs[0]?.tenant_id || '',
      });
      // Update each job to assigned
      await Promise.all(jobs.map(j =>
        base44.entities.PickupRequest.update(j.id, {
          status: 'assigned',
          assigned_vehicle_id: data.vehicle_id || j.assigned_vehicle_id,
        })
      ));
      return route;
    },
    onSuccess: onSaved,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[90dvh]">
        <div className="flex items-center justify-between p-6 pb-0 safe-top shrink-0 mb-5">
          <h3 className="font-semibold font-jakarta text-lg">Build Route</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>

        <div className="space-y-4 overflow-y-auto px-6 pb-6 safe-bottom">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Route Name</label>
            <input
              className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background"
              value={form.route_name}
              onChange={e => setForm(f => ({ ...f, route_name: e.target.value }))}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Assign Vehicle</label>
            <select
              className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background"
              value={form.vehicle_id}
              onChange={e => setForm(f => ({ ...f, vehicle_id: e.target.value }))}
            >
              <option value="">Select vehicle...</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.registration_number} — {v.vehicle_type}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Estimated Distance (km)</label>
            <input
              type="number"
              className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background"
              value={form.estimated_distance_km}
              onChange={e => setForm(f => ({ ...f, estimated_distance_km: e.target.value }))}
              placeholder="e.g. 45"
            />
          </div>

          <div className="bg-muted rounded-xl p-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Jobs in this route ({jobs.length})</p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {jobs.map((job, i) => (
                <div key={job.id} className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground w-5">{i + 1}.</span>
                  <span className="truncate">{job.address || 'No address'}</span>
                  <span className="text-muted-foreground capitalize shrink-0">{job.waste_type}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Notes</label>
            <textarea
              className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background resize-none"
              rows={2}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button
              className="flex-1"
              onClick={() => saveMutation.mutate(form)}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Saving...' : 'Publish Route'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}