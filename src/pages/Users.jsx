import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Users, UserPlus, Mail, Search, RefreshCw, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

const ROLES = ['admin', 'dispatcher', 'driver', 'billing_officer', 'user', 'customer'];

const getInviteStatus = (u) => (u.full_name && u.full_name.trim() ? 'active' : 'pending');

const roleColor = {
  admin: 'bg-red-100 text-red-700',
  super_admin: 'bg-purple-100 text-purple-700',
  dispatcher: 'bg-blue-100 text-blue-700',
  driver: 'bg-green-100 text-green-700',
  billing_officer: 'bg-amber-100 text-amber-700',
  customer: 'bg-gray-100 text-gray-600',
  user: 'bg-gray-100 text-gray-600',
};

function fmtDate(d) {
  if (!d) return '—';
  try { return format(new Date(d), 'dd MMM yyyy, HH:mm'); } catch { return '—'; }
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [inviting, setInviting] = useState(false);
  const [resendingId, setResendingId] = useState(null);
  const [search, setSearch] = useState('');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: invites = [], isLoading: loadingInvites } = useQuery({
    queryKey: ['user-invites'],
    queryFn: () => base44.entities.UserInvite.list('-sent_at', 100),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }) => base44.entities.User.update(userId, { role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['all-users'] }),
  });

  // Auto-mark accepted invites when corresponding user exists
  const acceptedEmails = new Set(users.map(u => u.email?.toLowerCase()));

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    const now = new Date().toISOString();
    await base44.users.inviteUser(inviteEmail, inviteRole);
    // Check if invite record already exists
    const existing = invites.find(i => i.email?.toLowerCase() === inviteEmail.toLowerCase());
    if (existing) {
      await base44.entities.UserInvite.update(existing.id, {
        sent_at: now,
        resend_count: (existing.resend_count || 0) + 1,
        status: 'pending',
      });
    } else {
      await base44.entities.UserInvite.create({
        email: inviteEmail,
        role: inviteRole,
        invited_by: currentUser?.full_name || currentUser?.email || 'Admin',
        sent_at: now,
        first_sent_at: now,
        resend_count: 0,
        status: 'pending',
      });
    }
    setInviting(false);
    setInviteOpen(false);
    setInviteEmail('');
    setInviteRole('user');
    queryClient.invalidateQueries({ queryKey: ['all-users'] });
    queryClient.invalidateQueries({ queryKey: ['user-invites'] });
  };

  const handleResend = async (invite) => {
    setResendingId(invite.id);
    await base44.users.inviteUser(invite.email, invite.role);
    await base44.entities.UserInvite.update(invite.id, {
      sent_at: new Date().toISOString(),
      resend_count: (invite.resend_count || 0) + 1,
      status: 'pending',
    });
    setResendingId(null);
    queryClient.invalidateQueries({ queryKey: ['user-invites'] });
  };

  // Enrich invites: mark accepted if user registered
  const enrichedInvites = invites.map(inv => {
    const isAccepted = acceptedEmails.has(inv.email?.toLowerCase());
    const matchedUser = users.find(u => u.email?.toLowerCase() === inv.email?.toLowerCase());
    return {
      ...inv,
      isAccepted,
      acceptedDate: isAccepted ? (matchedUser?.created_date || inv.accepted_at) : null,
    };
  });

  const filtered = users.filter(u =>
    !search ||
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const pendingInvites = enrichedInvites.filter(i => !i.isAccepted);
  const acceptedInvites = enrichedInvites.filter(i => i.isAccepted);

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

      <Tabs defaultValue="users">
        <TabsList className="mb-4">
          <TabsTrigger value="users">
            Active Users <Badge variant="secondary" className="ml-2 text-xs">{users.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="invites">
            Sent Invites
            {pendingInvites.length > 0 && (
              <Badge className="ml-2 text-xs bg-yellow-100 text-yellow-700">{pendingInvites.length} pending</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Active Users Tab ── */}
        <TabsContent value="users">
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
                  {[1, 2, 3, 4].map(i => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}
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
        </TabsContent>

        {/* ── Sent Invites Tab ── */}
        <TabsContent value="invites">
          <Card>
            <CardContent className="pt-4">
              {loadingInvites ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}
                </div>
              ) : enrichedInvites.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Mail className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No invites sent yet.</p>
                  <p className="text-xs mt-1">Invite users using the button above.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {/* Pending first, then accepted */}
                  {[...pendingInvites, ...acceptedInvites].map(inv => (
                    <div key={inv.id} className="flex items-center justify-between py-3 px-1 border-b border-border/40 last:border-0 gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${inv.isAccepted ? 'bg-green-100' : 'bg-yellow-100'}`}>
                          {inv.isAccepted
                            ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                            : <Clock className="w-4 h-4 text-yellow-600" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium truncate">{inv.email}</p>
                            <Badge variant="outline" className={`text-[10px] shrink-0 ${roleColor[inv.role] || 'bg-gray-100 text-gray-600'}`}>
                              {inv.role}
                            </Badge>
                            {inv.isAccepted
                              ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 shrink-0">Accepted</span>
                              : <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700 shrink-0">Pending</span>}
                          </div>
                          <div className="flex flex-wrap gap-x-4 mt-0.5">
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium">Sent:</span> {fmtDate(inv.first_sent_at || inv.sent_at)}
                              {(inv.resend_count > 0) && (
                                <span className="ml-1 text-blue-600">· Resent {inv.resend_count}×, last {fmtDate(inv.sent_at)}</span>
                              )}
                            </p>
                            {inv.isAccepted && (
                              <p className="text-xs text-green-700">
                                <span className="font-medium">Accepted:</span> {fmtDate(inv.acceptedDate)}
                              </p>
                            )}
                          </div>
                          {inv.invited_by && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">Invited by {inv.invited_by}</p>
                          )}
                        </div>
                      </div>
                      {!inv.isAccepted && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0 gap-1.5 text-xs"
                          disabled={resendingId === inv.id}
                          onClick={() => handleResend(inv)}
                        >
                          <RefreshCw className={`w-3 h-3 ${resendingId === inv.id ? 'animate-spin' : ''}`} />
                          {resendingId === inv.id ? 'Sending…' : 'Resend'}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Invite Dialog ── */}
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
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
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