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
import { Users, UserPlus, Mail, Search } from 'lucide-react';

const ROLES = ['admin', 'dispatcher', 'driver', 'billing_officer', 'user', 'customer'];

const getInviteStatus = (u) => {
  if (u.full_name && u.full_name.trim()) return 'active';
  return 'pending';
};

const roleColor = {
  admin: 'bg-red-100 text-red-700',
  super_admin: 'bg-purple-100 text-purple-700',
  dispatcher: 'bg-blue-100 text-blue-700',
  driver: 'bg-green-100 text-green-700',
  billing_officer: 'bg-amber-100 text-amber-700',
  customer: 'bg-gray-100 text-gray-600',
  user: 'bg-gray-100 text-gray-600',
};

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [inviting, setInviting] = useState(false);
  const [search, setSearch] = useState('');

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

  const filtered = users.filter(u =>
    !search ||
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-jakarta flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" /> User Management
          </h1>
          <p className="text-sm text-muted-foreground">Manage platform users, roles and access permissions</p>
        </div>
        <Button className="gap-2" onClick={() => setInviteOpen(true)}>
          <UserPlus className="w-4 h-4" /> Invite User
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>
            <Badge variant="outline" className="shrink-0">{filtered.length} user{filtered.length !== 1 ? 's' : ''}</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No users found.</p>
          ) : (
            <div className="divide-y divide-border/50">
              {filtered.map(u => (
                <div key={u.id} className="flex items-center justify-between py-3 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center shrink-0">
                      <span className="text-sm font-semibold text-primary">
                        {u.full_name?.[0] || u.email?.[0]?.toUpperCase() || '?'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{u.full_name || u.email?.split('@')[0] || '—'}</p>
                        {getInviteStatus(u) === 'pending' ? (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700 shrink-0">Pending</span>
                        ) : (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 shrink-0">Active</span>
                        )}
                      </div>
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
                        <SelectTrigger className="h-8 text-xs w-36">
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
      </Card>

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
    </div>
  );
}