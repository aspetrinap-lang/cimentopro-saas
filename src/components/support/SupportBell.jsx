import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { base44 } from '@/api/base44Client';
import { supportDesk } from '@/lib/supportClient';
import { fmtDateTime } from '@/lib/supportConstants';

// Sino de notificações do suporte — badge com não lidas + lista recente.
// Notificações são criadas apenas pelo backend, sempre direcionadas ao
// usuário destinatário (cliente ou SUPER_ADMIN, conforme o evento).
export default function SupportBell({ mode = 'customer' }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await supportDesk({ action: 'list_notifications' });
      setItems(res.notifications || []);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    load();
    const unsubscribe = base44.entities.SupportNotification.subscribe(() => load());
    const timer = setInterval(load, 60000);
    return () => { unsubscribe?.(); clearInterval(timer); };
  }, [load]);

  const unread = items.filter((n) => !n.read).length;

  const openNotification = async (n) => {
    setOpen(false);
    if (!n.read) {
      try { await supportDesk({ action: 'mark_notifications_read', ids: [n.id] }); load(); } catch { /* best effort */ }
    }
    if (!n.ticket_id) return;
    navigate(mode === 'admin' ? `/admin/suporte?ticket=${n.ticket_id}` : `/suporte/chamado/${n.ticket_id}`);
  };

  const markAll = async () => {
    try { await supportDesk({ action: 'mark_notifications_read' }); load(); } catch { /* best effort */ }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/8 transition-colors">
          <Bell className="w-4 h-4" /> Notificações
          {unread > 0 && (
            <span className="absolute left-[30px] top-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <p className="text-xs font-semibold text-foreground">Notificações</p>
          {unread > 0 && (
            <button onClick={markAll} className="text-[11px] text-primary hover:underline">Marcar todas como lidas</button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Nenhuma notificação.</p>
          ) : (
            items.map((n) => (
              <button key={n.id} onClick={() => openNotification(n)}
                className={`w-full text-left px-3 py-2.5 border-b border-border/50 hover:bg-muted/50 transition-colors ${!n.read ? 'bg-primary/5' : ''}`}>
                <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                  <span className="truncate">{n.title}</span>
                </p>
                {n.body && <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>}
                <p className="text-[10px] text-muted-foreground mt-0.5">{fmtDateTime(n.created_date)}</p>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}