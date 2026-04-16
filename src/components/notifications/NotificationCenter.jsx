import { useState, useEffect } from 'react';
import { Bell, X, CheckCheck, AlertCircle, Info, CheckCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';

const iconMap = {
  pickup_reminder: <Bell className="w-4 h-4 text-blue-500" />,
  pickup_completed: <CheckCircle className="w-4 h-4 text-green-500" />,
  pickup_missed: <AlertCircle className="w-4 h-4 text-red-500" />,
  invoice_issued: <Info className="w-4 h-4 text-purple-500" />,
  invoice_overdue: <AlertCircle className="w-4 h-4 text-red-500" />,
  payment_received: <CheckCircle className="w-4 h-4 text-green-500" />,
  custom: <Info className="w-4 h-4 text-gray-500" />,
};

export default function NotificationCenter() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('nlswms_dismissed_notifs') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const all = await base44.entities.Notification.list('-created_date', 30);
      // Filter to notifications relevant to this user (or all for admins)
      const relevant = user.role === 'admin' || user.role === 'super_admin'
        ? all
        : all.filter(n => n.recipient_email === user.email);
      setNotifications(relevant);
    };
    load();

    // Subscribe for real-time updates
    const unsub = base44.entities.Notification.subscribe((event) => {
      if (event.type === 'create') {
        setNotifications(prev => [event.data, ...prev].slice(0, 30));
      }
    });
    return () => unsub();
  }, [user]);

  const unread = notifications.filter(n => !dismissed.includes(n.id));
  const unreadCount = unread.length;

  const dismiss = (id) => {
    const next = [...dismissed, id];
    setDismissed(next);
    localStorage.setItem('nlswms_dismissed_notifs', JSON.stringify(next));
  };

  const dismissAll = () => {
    const next = [...dismissed, ...notifications.map(n => n.id)];
    setDismissed(next);
    localStorage.setItem('nlswms_dismissed_notifs', JSON.stringify(next));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative text-muted-foreground hover:text-foreground transition-colors">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="font-semibold text-sm font-jakarta">Notifications</span>
          {unreadCount > 0 && (
            <button onClick={dismissAll} className="text-xs text-primary hover:underline flex items-center gap-1">
              <CheckCheck className="w-3 h-3" /> Mark all read
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto divide-y divide-border/50">
          {notifications.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              <Bell className="w-6 h-6 mx-auto mb-2 opacity-30" />
              No notifications yet
            </div>
          ) : (
            notifications.map(n => {
              const isRead = dismissed.includes(n.id);
              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 transition-colors ${isRead ? 'opacity-60' : 'bg-primary/5'}`}
                >
                  <div className="mt-0.5 shrink-0">{iconMap[n.template_type] || iconMap.custom}</div>
                  <div className="flex-1 min-w-0">
                    {n.subject && <p className="text-xs font-semibold truncate">{n.subject}</p>}
                    <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {format(new Date(n.created_date), 'MMM d, HH:mm')}
                    </p>
                  </div>
                  {!isRead && (
                    <button onClick={() => dismiss(n.id)} className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
        {notifications.length > 0 && (
          <div className="px-4 py-2 border-t border-border text-center">
            <span className="text-xs text-muted-foreground">{notifications.length} total · {unreadCount} unread</span>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}