import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, LifeBuoy, ShieldAlert, Paperclip, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { supportDesk } from '@/lib/supportClient';
import TicketChat from '@/components/support/TicketChat';
import {
  STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS, CATEGORY_OPTIONS, SOURCE_LABELS, fmtDateTime, padTicketNumber,
} from '@/lib/supportConstants';

// Conversa do chamado (cliente). Notas internas nunca são exibidas — o
// backend as filtra. Anexos chegam como URL assinada temporária.
export default function TicketDetail() {
  const { id } = useParams();
  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [satisfaction, setSatisfaction] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [resolvedCheck, setResolvedCheck] = useState(true);
  const [comment, setComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  const load = useCallback(async () => {
    try {
      const [t, m] = await Promise.all([
        supportDesk({ action: 'get_ticket', ticket_id: id }),
        supportDesk({ action: 'list_messages', ticket_id: id }),
      ]);
      setTicket(t.ticket);
      setSatisfaction(t.satisfaction);
      setMessages(m.messages || []);
      setError(null);
    } catch (err) {
      setError(err.message || 'Não foi possível abrir o chamado.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  const submitRating = async () => {
    if (!rating) return;
    setSubmittingRating(true);
    try {
      const res = await supportDesk({
        action: 'submit_satisfaction', ticket_id: id, rating, resolved: resolvedCheck, comment,
      });
      setSatisfaction(res.satisfaction);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingRating(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <ShieldAlert className="w-10 h-10 text-red-500 mx-auto mb-3" />
        <h1 className="text-lg font-bold text-foreground">Acesso negado</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Este chamado não existe ou não pertence à sua empresa. {error !== 'Acesso negado' ? error : ''}
        </p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link to="/suporte">Voltar para Meus Chamados</Link>
        </Button>
      </div>
    );
  }

  const canRate = ['RESOLVED', 'CLOSED'].includes(ticket.status) && !satisfaction;

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-10">
      <Button asChild variant="ghost" size="sm" className="gap-1.5 mb-4 text-muted-foreground">
        <Link to="/suporte"><ArrowLeft className="w-4 h-4" /> Meus Chamados</Link>
      </Button>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-muted/30">
          <h1 className="font-bold text-foreground flex items-center gap-2 flex-wrap">
            <LifeBuoy className="w-5 h-5 text-primary" />
            <span className="text-muted-foreground font-mono">{padTicketNumber(ticket.ticket_number)}</span> {ticket.subject}
          </h1>
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[ticket.status]}`}>{STATUS_LABELS[ticket.status]}</span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[ticket.priority]}`}>{PRIORITY_LABELS[ticket.priority]}</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
              {CATEGORY_OPTIONS.find((c) => c.value === ticket.category)?.label || ticket.category}
            </span>
            {ticket.module && <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">{ticket.module}</span>}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Aberto em {fmtDateTime(ticket.created_date)} · Origem: {SOURCE_LABELS[ticket.source] || ticket.source}
            {ticket.assigned_to_name ? ` · Responsável: ${ticket.assigned_to_name}` : ' · Aguardando atribuição'}
          </p>
        </div>

        <div className="h-[420px] md:h-[480px] flex flex-col">
          <TicketChat ticket={ticket} messages={messages} admin={false} onSent={load} />
        </div>
      </div>

      {(satisfaction || canRate) && (
        <div className="mt-4 bg-card border border-border rounded-2xl p-5">
          {satisfaction ? (
            <p className="text-sm text-foreground flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500" />
              Você avaliou este atendimento com <strong>{satisfaction.rating}/5</strong>. Obrigado!
            </p>
          ) : (
            <>
              <h2 className="text-sm font-semibold text-foreground mb-1">Como foi o atendimento?</h2>
              <p className="text-xs text-muted-foreground mb-3">Sua avaliação ajuda a melhorar o suporte CimentoPro.</p>
              <div className="flex items-center gap-1.5 mb-3">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setRating(n)} className="transition-transform hover:scale-110">
                    <Star className={`w-7 h-7 ${n <= rating ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/40'}`} />
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 mb-3">
                <Checkbox id="resolved-check" checked={resolvedCheck} onCheckedChange={setResolvedCheck} />
                <Label htmlFor="resolved-check" className="text-xs">Meu problema foi resolvido</Label>
              </div>
              <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} maxLength={1000}
                placeholder="Comentário opcional…" className="mb-3" />
              <Button size="sm" onClick={submitRating} disabled={!rating || submittingRating} className="gap-2">
                {submittingRating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4 hidden" />}
                Enviar avaliação
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}