import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, LifeBuoy, Loader2, Bug } from 'lucide-react';
import { supportDesk } from '@/lib/supportClient';
import { activeCompanyId } from '@/lib/companyScope';
import {
  STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS, CATEGORY_OPTIONS, fmtDateTime, padTicketNumber,
} from '@/lib/supportConstants';

const FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'open', label: 'Abertos', statuses: ['OPEN', 'IN_PROGRESS', 'WAITING_INTERNAL'] },
  { key: 'waiting', label: 'Aguardando cliente', statuses: ['WAITING_CUSTOMER'] },
  { key: 'resolved', label: 'Resolvidos', statuses: ['RESOLVED'] },
  { key: 'closed', label: 'Fechados', statuses: ['CLOSED'] },
];

// Meus Chamados — lista somente os chamados da empresa ativa (o backend
// valida o vínculo; o frontend apenas consulta com o escopo atual).
export default function MyTickets() {
  const [tickets, setTickets] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    const cid = activeCompanyId();
    if (!cid) { setTickets([]); return; }
    try {
      const res = await supportDesk({ action: 'list_tickets', company_id: cid });
      setTickets(res.tickets || []);
    } catch {
      setTickets([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = (tickets || []).filter((t) => {
    const f = FILTERS.find((x) => x.key === filter);
    if (f && f.statuses && !f.statuses.includes(t.status)) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return padTicketNumber(t.ticket_number).includes(q)
      || String(t.subject || '').toLowerCase().includes(q)
      || String(t.module || '').toLowerCase().includes(q);
  });

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-10">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
            <LifeBuoy className="w-6 h-6 text-primary" /> Meus Chamados
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Acompanhe suas solicitações e converse com o suporte CimentoPro.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="gap-2">
            <Link to="/suporte/novo?relatar=1&page=%2Fsuporte">
              <Bug className="w-4 h-4" /> Relatar problema
            </Link>
          </Button>
          <Button asChild className="gap-2">
            <Link to="/suporte/novo">
              <Plus className="w-4 h-4" /> Abrir Chamado
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              filter === f.key ? 'bg-primary text-white border-primary font-medium' : 'bg-card text-muted-foreground border-border hover:text-foreground'
            }`}>
            {f.label}
          </button>
        ))}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar nº, assunto, módulo…" className="pl-8 h-9 text-sm" />
        </div>
      </div>

      {tickets === null ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-2xl bg-card">
          <LifeBuoy className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum chamado encontrado.</p>
          <Button asChild size="sm" variant="outline" className="mt-3">
            <Link to="/suporte/novo">Abrir o primeiro chamado</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visible.map((t) => (
            <Link key={t.id} to={`/suporte/chamado/${t.id}`}
              className="block bg-card border border-border rounded-xl p-4 hover:border-primary/40 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground text-sm">
                    <span className="text-muted-foreground font-mono">{padTicketNumber(t.ticket_number)}</span> · {t.subject}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {CATEGORY_OPTIONS.find((c) => c.value === t.category)?.label || t.category}
                    {t.module ? ` · ${t.module}` : ''} · Última atualização {fmtDateTime(t.last_message_at || t.created_date)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[t.priority]}`}>{PRIORITY_LABELS[t.priority]}</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[t.status]}`}>{STATUS_LABELS[t.status]}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}