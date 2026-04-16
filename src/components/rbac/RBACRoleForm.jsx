import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';

const ROLE_TYPES = ['super_admin','city_admin','city_analyst','operator_admin','operator_manager','dispatcher','driver','field_agent','billing_officer','compliance_officer','customer','support_agent','readonly'];

const COMMON_PERMISSIONS = [
  'customers:read','customers:write','invoices:read','invoices:write',
  'payments:read','payments:write','jobs:read','jobs:write','jobs:complete','jobs:assign',
  'routes:read','routes:write','vehicles:read','vehicles:write',
  'zones:read','zones:write','analytics:read','reports:read','reports:write',
  'compliance:read','compliance:write','audit:read','evidence:read','evidence:upload',
  'receipts:read','receipts:write','statements:read','operators:read','*'
];

const COMMON_SCOPES = ['tenant:*','tenant:own','tenant:city','tenant:operator:read','zone:assigned','branch:assigned','facility:assigned','customer:own','jobs:own'];

export default function RBACRoleForm({ role, onClose }) {
  const [form, setForm] = useState({
    role_name: role?.role_name || '',
    role_type: role?.role_type || 'operator_admin',
    description: role?.description || '',
    status: role?.status || 'active',
    permissions: role?.permissions || [],
    scopes: role?.scopes || [],
    notes: role?.notes || '',
  });
  const [newPerm, setNewPerm] = useState('');
  const [newScope, setNewScope] = useState('');

  const qc = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: (data) => role
      ? base44.entities.RBACRole.update(role.id, data)
      : base44.entities.RBACRole.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rbac-roles'] }); onClose(); },
  });

  const addTag = (field, value, setter) => {
    if (!value.trim()) return;
    setForm(f => ({ ...f, [field]: [...new Set([...f[field], value.trim()])] }));
    setter('');
  };

  const removeTag = (field, value) => setForm(f => ({ ...f, [field]: f[field].filter(x => x !== value) }));

  return (
    <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Role Name *</Label>
          <Input value={form.role_name} onChange={e => setForm(f => ({ ...f, role_name: e.target.value }))} required />
        </div>
        <div className="space-y-1.5">
          <Label>Role Type *</Label>
          <Select value={form.role_type} onValueChange={v => setForm(f => ({ ...f, role_type: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ROLE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Description</Label>
        <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
      </div>

      {/* Permission Scopes */}
      <div className="space-y-2">
        <Label>Permission Scopes</Label>
        <div className="flex flex-wrap gap-1.5 min-h-8">
          {form.scopes.map(s => (
            <Badge key={s} variant="secondary" className="gap-1 text-xs font-mono">
              {s} <button type="button" onClick={() => removeTag('scopes', s)}><X className="w-3 h-3" /></button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Select value={newScope} onValueChange={setNewScope}>
            <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue placeholder="Add scope…" /></SelectTrigger>
            <SelectContent>
              {COMMON_SCOPES.map(s => <SelectItem key={s} value={s} className="text-xs font-mono">{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input value={newScope} onChange={e => setNewScope(e.target.value)} placeholder="or type custom…" className="flex-1 h-8 text-xs" />
          <Button type="button" size="sm" variant="outline" onClick={() => addTag('scopes', newScope, setNewScope)}><Plus className="w-3 h-3" /></Button>
        </div>
      </div>

      {/* Permissions */}
      <div className="space-y-2">
        <Label>Permissions</Label>
        <div className="flex flex-wrap gap-1.5 min-h-8">
          {form.permissions.map(p => (
            <Badge key={p} variant="outline" className="gap-1 text-xs font-mono">
              {p} <button type="button" onClick={() => removeTag('permissions', p)}><X className="w-3 h-3" /></button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Select value={newPerm} onValueChange={v => { addTag('permissions', v, setNewPerm); }}>
            <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue placeholder="Add permission…" /></SelectTrigger>
            <SelectContent>
              {COMMON_PERMISSIONS.map(p => <SelectItem key={p} value={p} className="text-xs font-mono">{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input value={newPerm} onChange={e => setNewPerm(e.target.value)} placeholder="or type custom…" className="flex-1 h-8 text-xs" />
          <Button type="button" size="sm" variant="outline" onClick={() => addTag('permissions', newPerm, setNewPerm)}><Plus className="w-3 h-3" /></Button>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
        <Button type="submit" disabled={saveMutation.isPending} className="flex-1">
          {saveMutation.isPending ? 'Saving…' : role ? 'Update Role' : 'Create Role'}
        </Button>
      </div>
    </form>
  );
}