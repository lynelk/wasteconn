import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Users, UserPlus, Mail } from 'lucide-react';

const ROLES = ['admin', 'dispatcher', 'driver', 'billing_officer', 'user', 'customer'];

const roleColor = {
  admin: 'bg-red-100 text-red-700',
  super_admin: 'bg-purple-100 text-purple-700',
  dispatcher: 'bg-blue-100 text-blue-700',
  driver: 'bg-green-100 text-green-700',
  billing_officer: 'bg-amber-100 text-amber-700',
  customer: 'bg-gray-100 text-gray-600',
  user: 'bg-gray-100 text-gray-600',
};

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [inviting, setInviting] = useState(false);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => base44.entities.User.list(),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }) => base44.entities.User.update(userId, { role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['all-users'] }),
  });

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    await base44.users.inviteUser(inviteEmail, inviteRole);
    setInviting(false);
    setInviteOpen(false);
    setInviteEmail('');
    setInviteRole('user');
    queryClient.invalidateQueries({ queryKey: ['all-users'] });
  };

  if (currentUser?.role !== 'admin' && currentUser?.role !== 'super_admin') return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> User Management
          </CardTitle>
          <Button size="sm" className="gap-1.5" onClick={() => setInviteOpen(true)}>
            <UserPlus className="w-4 h-4" /> Invite User
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {users.map(u => (
              <div key={u.id} className="flex items-center justify-between py-3 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <span className="text-xs font-semibold text-primary">
                      {u.full_name?.[0] || u.email?.[0]?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{u.full_name || '—'}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {u.id === currentUser?.id ? (
                    <Badge className={`text-xs ${roleColor[u.role] || 'bg-gray-100 text-gray-600'}`}>
                      {u.role} (you)
                    </Badge>
                  ) : (
                    <Select
                      value={u.role || 'user'}
                      onValueChange={(role) => updateRoleMutation.mutate({ userId: u.id, role })}
                      disabled={u.role === 'super_admin'}
                    >
                      <SelectTrigger className="h-7 text-xs w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map(r => (
                          <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" /> Invite User
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs mb-1.5 block">Email address</Label>
              <Input
                type="email"
                placeholder="user@example.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={!inviteEmail || inviting}>
              {inviting ? 'Sending…' : 'Send Invite'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}