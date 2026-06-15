import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, ChevronRight, Edit2, Trash2, MapPin, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ZoneHierarchyForm from '@/components/zones/ZoneHierarchyForm';

const LEVEL_COLORS = {
  region: 'bg-purple-100 text-purple-700',
  district: 'bg-blue-100 text-blue-700',
  county: 'bg-cyan-100 text-cyan-700',
  sub_county: 'bg-green-100 text-green-700',
  town: 'bg-yellow-100 text-yellow-700',
  village: 'bg-orange-100 text-orange-700',
  custom: 'bg-gray-100 text-gray-600',
};

const LEVEL_ORDER = ['region', 'district', 'county', 'sub_county', 'town', 'village', 'custom'];

export default function ZoneHierarchyAdmin() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [parentPreset, setParentPreset] = useState(null);
  const [filterLevel, setFilterLevel] = useState('all');
  const [expandedIds, setExpandedIds] = useState(new Set());

  const { data: zones = [], isLoading } = useQuery({
    queryKey: ['zone-hierarchy'],
    queryFn: () => base44.entities.ZoneHierarchy.list(),
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => base44.entities.Tenant.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.ZoneHierarchy.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['zone-hierarchy'] }),
  });

  const roots = zones.filter(z => !z.parent_id && (filterLevel === 'all' || z.level === filterLevel));

  const getChildren = (parentId) => zones.filter(z => z.parent_id === parentId);

  const toggleExpand = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openAdd = (parent = null) => {
    setParentPreset(parent);
    setEditing(null);
    setOpen(true);
  };

  const ZoneNode = ({ zone, depth = 0 }) => {
    const children = getChildren(zone.id);
    const expanded = expandedIds.has(zone.id);
    const operator = tenants.find(t => t.id === zone.assigned_operator_id);

    return (
      <div className={`${depth > 0 ? 'ml-6 border-l border-border/50 pl-3' : ''}`}>
        <div className="flex items-center gap-2 py-2 group hover:bg-muted/40 rounded-lg px-2 -mx-2">
          <button
            onClick={() => toggleExpand(zone.id)}
            className="w-5 h-5 flex items-center justify-center text-muted-foreground"
          >
            {children.length > 0 ? (
              <ChevronRight className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`} />
            ) : <span className="w-3.5" />}
          </button>

          <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{zone.name}</span>
              <Badge className={`text-[10px] px-1.5 py-0 ${LEVEL_COLORS[zone.level]}`} variant="secondary">
                {zone.custom_label || zone.level.replace('_', ' ')}
              </Badge>
              {zone.status !== 'active' && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-destructive border-destructive/30">
                  {zone.status}
                </Badge>
              )}
              {zone.sla_hours && (
                <span className="text-[10px] text-muted-foreground">SLA: {zone.sla_hours}h</span>
              )}
              {operator && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Building2 className="w-2.5 h-2.5" />{operator.company_name}
                </span>
              )}
            </div>
            {zone.path && <p className="text-[10px] text-muted-foreground/60">{zone.path}</p>}
          </div>

          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => openAdd(zone)} className="text-muted-foreground hover:text-primary p-1" title="Add child zone">
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => { setEditing(zone); setParentPreset(null); setOpen(true); }} className="text-muted-foreground hover:text-foreground p-1">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => deleteMutation.mutate(zone.id)} className="text-muted-foreground hover:text-destructive p-1">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {expanded && children.length > 0 && (
          <div>
            {children.map(child => (
              <ZoneNode key={child.id} zone={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  const levelCounts = LEVEL_ORDER.reduce((acc, l) => {
    acc[l] = zones.filter(z => z.level === l).length;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-jakarta flex items-center gap-2">
            <MapPin className="w-6 h-6 text-primary" /> CityOS Zone Hierarchy
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Uganda administrative zone management — Region › District › County › Sub-County › Town › Village</p>
        </div>
        <Button onClick={() => openAdd()} className="gap-2">
          <Plus className="w-4 h-4" /> Add Zone
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {LEVEL_ORDER.slice(0, 6).map(level => (
          <Card key={level} className="border-border/60">
            <CardContent className="pt-3 pb-3 text-center">
              <div className="text-xl font-bold font-jakarta text-primary">{levelCounts[level] || 0}</div>
              <div className="text-[10px] text-muted-foreground capitalize">{level.replace('_', ' ')}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Filter by level:</span>
        <Select value={filterLevel} onValueChange={setFilterLevel}>
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            {LEVEL_ORDER.map(l => (
              <SelectItem key={l} value={l}>{l.replace('_', ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tree */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Zone Tree ({zones.length} zones)</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{[1,2,3,4].map(i=><div key={i} className="h-8 rounded bg-muted animate-pulse"/>)}</div>
          ) : roots.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MapPin className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No zones yet. Start by adding a Region.</p>
              <Button className="mt-4 gap-2" size="sm" onClick={() => openAdd()}>
                <Plus className="w-4 h-4" /> Add First Zone
              </Button>
            </div>
          ) : (
            <div className="space-y-0.5">
              {roots.map(zone => (
                <ZoneNode key={zone.id} zone={zone} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={() => { setOpen(false); setEditing(null); setParentPreset(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-jakarta">
              {editing ? 'Edit Zone' : parentPreset ? `Add child of "${parentPreset.name}"` : 'Add Zone'}
            </DialogTitle>
          </DialogHeader>
          <ZoneHierarchyForm
            zone={editing}
            parentPreset={parentPreset}
            allZones={zones}
            tenants={tenants}
            onClose={() => { setOpen(false); setEditing(null); setParentPreset(null); }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}