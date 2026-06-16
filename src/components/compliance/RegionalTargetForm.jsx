import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function RegionalTargetForm({ target, onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    region_name: target?.region_name || '',
    target_name: target?.target_name || '',
    target_value_kg: target?.target_value_kg || '',
    current_value_kg: target?.current_value_kg || 0,
    year: target?.year || new Date().getFullYear(),
    status: target?.status || 'on_track',
    notes: target?.notes || '',
  });

  const mutation = useMutation({
    mutationFn: (data) => target
      ? base44.entities.RegionalTarget.update(target.id, data)
      : base44.entities.RegionalTarget.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regional-targets'] });
      onClose();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate({ ...form, target_value_kg: Number(form.target_value_kg), current_value_kg: Number(form.current_value_kg), year: Number(form.year) });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{target ? 'Edit Target' : 'Add Regional Target'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1 block">Region / City</Label>
              <Input value={form.region_name} onChange={e => setForm(f => ({...f, region_name: e.target.value}))} placeholder="e.g. Kampala Central" required />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Year</Label>
              <Input type="number" value={form.year} onChange={e => setForm(f => ({...f, year: e.target.value}))} placeholder="2026" required />
            </div>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Target Name</Label>
            <Input value={form.target_name} onChange={e => setForm(f => ({...f, target_name: e.target.value}))} placeholder="e.g. Annual Waste Diversion Goal" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1 block">Target (kg)</Label>
              <Input type="number" value={form.target_value_kg} onChange={e => setForm(f => ({...f, target_value_kg: e.target.value}))} placeholder="100000" required />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Current (kg)</Label>
              <Input type="number" value={form.current_value_kg} onChange={e => setForm(f => ({...f, current_value_kg: e.target.value}))} placeholder="0" />
            </div>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Status</Label>
            <Select value={form.status} onValueChange={v => setForm(f => ({...f, status: v}))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="on_track">On Track</SelectItem>
                <SelectItem value="at_risk">At Risk</SelectItem>
                <SelectItem value="behind">Behind</SelectItem>
                <SelectItem value="achieved">Achieved</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save Target'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}