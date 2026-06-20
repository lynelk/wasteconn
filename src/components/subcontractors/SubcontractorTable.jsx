import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Building2, Phone, Mail, Truck } from 'lucide-react';
import SubcontractorOnboardForm from './SubcontractorOnboardForm';

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-700',
  suspended: 'bg-yellow-100 text-yellow-700',
  inactive: 'bg-gray-100 text-gray-500',
};

export default function SubcontractorTable() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const qc = useQueryClient();

  const { data: subcontractors = [], isLoading } = useQuery({
    queryKey: ['subcontractors'],
    queryFn: () => base44.entities.Subcontractor.list('-created_date', 100),
  });

  const handleSaved = () => {
    qc.invalidateQueries({ queryKey: ['subcontractors'] });
    setShowForm(false);
    setEditing(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{subcontractors.length} subcontractor(s)</p>
        <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Add Subcontractor
        </Button>
      </div>

      {showForm && (
        <SubcontractorOnboardForm
          initial={editing}
          onSaved={handleSaved}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      )}

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground text-sm">Loading…</div>
      ) : subcontractors.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">No subcontractors yet. Add one above.</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {subcontractors.map(s => (
            <Card key={s.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary shrink-0" />
                    <p className="font-semibold text-sm">{s.company_name}</p>
                  </div>
                  <Badge className={`text-xs ${STATUS_COLORS[s.status] || ''}`}>{s.status}</Badge>
                </div>
                {s.contact_name && <p className="text-xs text-muted-foreground">{s.contact_name}</p>}
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {s.contact_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{s.contact_phone}</span>}
                  {s.contact_email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{s.contact_email}</span>}
                  {s.vehicle_count && <span className="flex items-center gap-1"><Truck className="w-3 h-3" />{s.vehicle_count} vehicles</span>}
                </div>
                <div className="flex justify-end pt-1">
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { setEditing(s); setShowForm(true); }}>
                    Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}