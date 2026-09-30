import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Inbox, LifeBuoy, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supportDesk } from '@/lib/supportClient';
import TicketChat from '@/components/support/TicketChat';
import TicketAdminBar from '@/components/support/TicketAdminBar';
import {
  STATUS_LABELS, STATUS_COLORS, STATUS_OPTIONS, PRIORITY_LABELS, PRIORITY_COLORS, PRIORITY_OPTIONS,
  CATEGORY_OPTIONS, fmtDateTime, padTicketNumber,
} from '@/lib/supportConstants';

// Central de Atendimento (SUPER_ADMIN) — visão global: KPIs reais, inbox
// priorizada (urgentes primeiro), filtros e atendimento do chamado
// (responder, nota interna, atribuir, status, prioridade, categoria).
export default function AdminSupport() {
  const [params, setParams] = useSearchParams();
  const [meta, setMeta] = useState(null);
  const [tickets, setTickets] = useState(null);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [detailError, setDetailError] = useState(null);
  const [filters, setFilters] = useState({ status: 'all', priority: 'all', category: 'all', company_id: 'all', from: '', to: '' });

  const loadMeta = useCallback(async () => {
    try {
      const res = await supportDesk({ action: 'admin_meta' });
      setMeta(res);
    } catch {
      setMeta({ companies: [], admins: [], kpis: null });
    }
  }, []);

  const loadTickets = useCallback(async () => {
    const payload = { action: 'list_tickets' };
    Object.entries(filters).forEach(([k, v]) => { if (v && v !== 'all') payload[k] = v; });
    try {
      const res = await supportDesk(payload);
      setTickets(res.tickets || []);
    } catch {
      setTickets([]);
    }
  }, [filters]);

  const loadDetail = useCallback(async (ticketId) => {
    setDetailError(null);
    setMessages([]);
    try {
      const [t, m] = await Promise.all([
        supportDesk({ action: 'get_ticket', ticket_id: ticketId }),
        supportDesk({ action: 'list_messages', ticket_id: ticketId }),
      ]);
      setSelected(t.ticket);
      setMessages(m.messages || []);
    } catch (err) {
      setDetailError(err.message || 'Falha ao abrir o chamado.');
      setSelected(null);
    }
  }, []);

  useEffect(() => { loadMeta(); }, [loadMeta]);
  useEffect(() => { loadTickets(); }, [loadTickets]);
  useEffect(() => {
    const tid = params.get('ticket');
    if (tid) loadDetail(tid);
  }, [params, loadDetail]);

  const selectTicket = (id) => {
    setParams({ ticket: id });
    loadDetail(id);
  };

  const changed = (ticket) => {
    setSelected(ticket);
    loadTickets();
    loadMeta();
  };

  const refresh = async () => { await Promise.all([loadTickets(), loadDetail(params.get('ticket'))]); loadMeta(); };

  const kpis = meta?.kpis;
  const kpiCards = kpis ? [
    { label: 'Abertos', value: kpis.open, tone: 'text-sky-600' },
    { label: 'Em atendimento', value: kpis.in_progress, tone: 'text-indigo-600' },
    { label: 'Aguardando cliente', value: kpis.waiting_customer, tone: 'text-amber-600' },
    { label: 'Urgentes', value: kpis.urgent, tone: 'text-red-600' },
    { label: 'Resolvidos hoje', value: kpis.resolved_today, tone: 'text-green-600' },
    { label: '1ª resposta (média)', value: kpis.avg_first_response_hours == null ? '—' : `${kpis.avg_first_response_hours.toFixed(1)} h`, tone: 'text-foreground' },
    { label: 'Resolução (média)', value: kpis.avg_resolution_hours == null ? '—' : `${kpis.avg_resolution_hours.toFixed(1)} h`, tone: 'text-foreground' },
    { label: `CSAT (${kpis.ratings_count || 0})`, value: kpis.csat == null ? '—' : kpis.csat.toFixed(1), tone: 'text-amber-600' },
  ] : [];

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <LifeBuoy className="w-6 h-6 text-indigo-600" /> Central de Atendimento
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Suporte global — todas as empresas da plataforma.</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Atualizar
        </Button>
      </div>

      {/* KPIs — calculados a partir dos chamados reais */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2.5 mb-6">
        {kpiCards.map((k) => (
          <div key={k.label} className="bg-white border border-slate-200 rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold leading-tight">{k.label}</p>
            <p className={`text-xl font-bold mt-1 ${k.tone}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Inbox */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
            <Inbox className="w-4 h-4 text-indigo-600" />
            <p className="text-sm font-semibold text-slate-900">Chamados</p>
          </div>
          <div className="px-3 py-2.5 border-b border-slate-100 grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase text-slate-400">Status</Label>
              <Select value={filters.status} onValueChange={(v) => setFilter('status', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase text-slate-400">Prioridade</Label>
              <Select value={filters.priority} onValueChange={(v) => setFilter('priority', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {PRIORITY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase text-slate-400">Categoria</Label>
              <Select value={filters.category} onValueChange={(v) => setFilter('category', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {CATEGORY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase text-slate-400">Empresa</Label>
              <Select value={filters.company_id} onValueChange={(v) => setFilter('company_id', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {(meta?.companies || []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-2 grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-slate-400">De</Label>
                <Input type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-slate-400">Até</Label>
                <Input type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[480px]">
            {tickets === null ? (
              <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-indigo-600" /></div>
            ) : tickets.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-12">Nenhum chamado nos filtros atuais.</p>
            ) : (
              tickets.map((t) => (
                <button key={t.id} onClick={() => selectTicket(t.id)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                    params.get('ticket') === t.id ? 'bg-indigo-50' : ''
                  }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate">{t.company_name}</p>
                      <p className="text-xs text-slate-600 truncate">
                        <span className="font-mono text-slate-400">{padTicketNumber(t.ticket_number)}</span> · {t.subject}
                      </p>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${PRIORITY_COLORS[t.priority]}`}>
                      {PRIORITY_LABELS[t.priority]}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[t.status]}`}>{STATUS_LABELS[t.status]}</span>
                    <span className="text-[10px] text-slate-400">{fmtDateTime(t.last_message_at || t.created_date)}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Conversa */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col min-h-[480px]">
          {detailError ? (
            <p className="text-sm text-red-600 text-center py-16">{detailError}</p>
          ) : !selected ? (
            <p className="text-sm text-slate-400 text-center py-16">Selecione um chamado na inbox para atender.</p>
          ) : (
            <>
              <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
                <h2 className="font-semibold text-slate-900 text-sm flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-slate-400">{padTicketNumber(selected.ticket_number)}</span> {selected.subject}
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {selected.company_name} · {selected.created_by_name || selected.created_by_email} · {CATEGORY_OPTIONS.find((c) => c.value === selected.category)?.label}
                  {selected.module ? ` · ${selected.module}` : ''} · {fmtDateTime(selected.created_date)}
                </p>
              </div>
              <TicketAdminBar ticket={selected} admins={meta?.admins || []} onChanged={changed} />
              <div className="flex-1 flex flex-col min-h-[360px]">
                <TicketChat ticket={selected} messages={messages} admin onSent={refresh} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}