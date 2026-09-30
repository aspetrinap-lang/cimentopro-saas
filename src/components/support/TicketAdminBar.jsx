import React, { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supportDesk } from '@/lib/supportClient';
import { STATUS_OPTIONS, PRIORITY_OPTIONS, CATEGORY_OPTIONS } from '@/lib/supportConstants';

// Barra administrativa do chamado — SUPER_ADMIN altera responsável, prioridade,
// categoria e status. Toda alteração é validada e auditada no backend.
export default function TicketAdminBar({ ticket, admins, onChanged }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  if (!ticket) return null;

  const update = async (field, value) => {
    setBusy(true);
    try {
      const res = await supportDesk({ action: 'update_ticket', ticket_id: ticket.id, [field]: value });
      toast({ title: 'Chamado atualizado', description: 'Alteração registrada na auditoria.' });
      onChanged?.(res.ticket);
    } catch (err) {
      toast({ title: 'Não foi possível atualizar', description: err.message || 'Tente novamente.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex flex-wrap items-end gap-3 px-4 py-3 border-b border-border bg-muted/30">
      {busy && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
        </div>
      )}
      <div className="space-y-1 min-w-[150px]">
        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Status</Label>
        <Select value={ticket.status} onValueChange={(v) => update('status', v)}>
          <SelectTrigger className="h-8 text-xs w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>{STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1 min-w-[120px]">
        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Prioridade</Label>
        <Select value={ticket.priority} onValueChange={(v) => update('priority', v)}>
          <SelectTrigger className="h-8 text-xs w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>{PRIORITY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1 min-w-[160px]">
        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Categoria</Label>
        <Select value={ticket.category} onValueChange={(v) => update('category', v)}>
          <SelectTrigger className="h-8 text-xs w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>{CATEGORY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1 min-w-[180px]">
        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Responsável</Label>
        <Select
          value={ticket.assigned_to || '__ninguem__'}
          onValueChange={(v) => update('assigned_to', v === '__ninguem__' ? '' : v)}
        >
          <SelectTrigger className="h-8 text-xs w-[190px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__ninguem__">Sem responsável</SelectItem>
            {admins.map((a) => <SelectItem key={a.id} value={a.id}>{a.full_name || a.email}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}