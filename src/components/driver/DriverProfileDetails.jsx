import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  CreditCard, Shield, AlertTriangle, MessageSquare, Clock, Pencil, Save, X, ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

export default function DriverProfileDetails({ driver, driverId }) {
  const qc = useQueryClient();
  const [editingDocs, setEditingDocs] = useState(false);
  const [docForm, setDocForm] = useState({
    driving_permit_number: driver?.driving_permit_number || '',
    driving_permit_expiry: driver?.driving_permit_expiry || '',
    nin: driver?.nin || '',
  });

  const { data: complaints = [] } = useQuery({
    queryKey: ['driver-complaints', driverId],
    queryFn: () => base44.entities.Complaint.filter({ assigned_to: driverId }),
    enabled: !!driverId,
  });

  const { data: pickups = [] } = useQuery({
    queryKey: ['driver-jobs', driverId],
    queryFn: () => base44.entities.PickupRequest.filter({ assigned_driver_id: driverId }, '-completed_at', 100),
    enabled: !!driverId,
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.auth.updateMe(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['driver', driverId] }); setEditingDocs(false); },
  });

  const incidents = pickups.filter(p => p.cv_flagged_for_review || p.speed_flag === 'too_fast');

  const priorityColor = { low: 'bg-gray-100 text-gray-600', medium: 'bg-yellow-100 text-yellow-700', high: 'bg-orange-100 text-orange-700', urgent: 'bg-red-100 text-red-700' };
  const statusColor = { open: 'bg-blue-100 text-blue-700', in_review: 'bg-purple-100 text-purple-700', resolved: 'bg-green-100 text-green-700', closed: 'bg-gray-100 text-gray-500' };

  return (
    <div className="space-y-5">
      {/* Documents Section */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold font-jakarta flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" /> Licencing & Identity
            </CardTitle>
            {!editingDocs ? (
              <Button variant="ghost" size="sm" onClick={() => setEditingDocs(true)}>
                <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setEditingDocs(false)}><X className="w-3.5 h-3.5" /></Button>
                <Button size="sm" onClick={() => updateMutation.mutate(docForm)} disabled={updateMutation.isPending}>
                  <Save className="w-3.5 h-3.5 mr-1" />{updateMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {editingDocs ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Driving Permit No.</Label>
                <Input value={docForm.driving_permit_number} onChange={e => setDocForm(f => ({ ...f, driving_permit_number: e.target.value }))} placeholder="e.g. DL-UG-123456" />
              </div>
              <div className="space-y-1.5">
                <Label>Permit Expiry Date</Label>
                <Input type="date" value={docForm.driving_permit_expiry} onChange={e => setDocForm(f => ({ ...f, driving_permit_expiry: e.target.value }))} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>National ID Number (NIN)</Label>
                <Input value={docForm.nin} onChange={e => setDocForm(f => ({ ...f, nin: e.target.value }))} placeholder="e.g. CM86001001LRQN" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Driving Permit No.</p>
                <p className="font-medium">{driver?.driving_permit_number || <span className="text-muted-foreground italic">Not set</span>}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Permit Expiry</p>
                <p className={`font-medium ${driver?.driving_permit_expiry && new Date(driver.driving_permit_expiry) < new Date() ? 'text-red-600' : ''}`}>
                  {driver?.driving_permit_expiry || <span className="text-muted-foreground italic">Not set</span>}
                  {driver?.driving_permit_expiry && new Date(driver.driving_permit_expiry) < new Date() && (
                    <Badge className="ml-2 text-[10px] bg-red-100 text-red-700" variant="secondary">EXPIRED</Badge>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">NIN</p>
                <p className="font-medium font-mono text-xs">{driver?.nin || <span className="text-muted-foreground italic">Not set</span>}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Incidents */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold font-jakarta flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" /> Incident Reports ({incidents.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {incidents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No incidents recorded.</p>
          ) : (
            <div className="space-y-2">
              {incidents.slice(0, 10).map(p => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{p.address || 'Job #' + p.id.slice(0, 6)}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {p.cv_flagged_for_review && <span className="mr-2 text-orange-600">📷 Photo flagged</span>}
                      {p.speed_flag === 'too_fast' && <span className="text-red-600">⚡ Speed alert</span>}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 ml-2">
                    {p.completed_at ? format(new Date(p.completed_at), 'MMM d, yyyy') : p.scheduled_date || '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Associated Complaints */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold font-jakarta flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-500" /> Associated Complaints ({complaints.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {complaints.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No complaints linked to this driver.</p>
          ) : (
            <div className="space-y-2">
              {complaints.map(c => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge className={`text-[10px] ${priorityColor[c.priority] || ''}`} variant="secondary">{c.priority}</Badge>
                      <Badge className={`text-[10px] ${statusColor[c.status] || ''}`} variant="secondary">{c.status?.replace('_', ' ')}</Badge>
                    </div>
                    <p className="text-xs font-medium truncate capitalize">{c.category?.replace(/_/g, ' ')}</p>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">{c.description}</p>
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0 ml-2">
                    {c.created_date ? format(new Date(c.created_date), 'MMM d') : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}