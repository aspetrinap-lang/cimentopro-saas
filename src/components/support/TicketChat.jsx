import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Paperclip, Send } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supportDesk, uploadSupportAttachment, isAcceptedFile } from '@/lib/supportClient';
import { fmtDateTime, padTicketNumber } from '@/lib/supportConstants';

// Conversa do chamado em formato chat. Notas internas (is_internal) chegam
// apenas para o suporte — o backend nunca as entrega ao cliente.
export default function TicketChat({ ticket, messages, admin, onSent }) {
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [internalNote, setInternalNote] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef(null);
  const fileInput = useRef(null);

  const isAdminView = !!admin;
  // Cliente vê as próprias mensagens à direita; suporte vê as suas à direita.
  const isMine = (m) => (isAdminView ? m.sender_type === 'SUPPORT' : m.sender_type === 'CUSTOMER');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const pickFiles = async (files) => {
    const list = Array.from(files || []);
    if (!list.length) return;
    const room = 5 - attachments.length;
    if (room <= 0) {
      toast({ title: 'Limite de anexos', description: 'Máximo de 5 arquivos por mensagem.' });
      return;
    }
    setUploading(true);
    const added = [];
    try {
      for (const file of list.slice(0, room)) {
        if (!isAcceptedFile(file)) {
          toast({ title: 'Arquivo não aceito', description: `${file.name}: use PNG, JPG, WEBP, PDF, XLSX ou CSV até 10 MB.` });
          continue;
        }
        added.push(await uploadSupportAttachment(file));
      }
      setAttachments((a) => [...a, ...added]);
    } finally {
      setUploading(false);
    }
  };

  const send = async () => {
    if (!text.trim() && !attachments.length) return;
    setSending(true);
    try {
      await supportDesk({
        action: 'send_message',
        ticket_id: ticket.id,
        message: text.trim(),
        is_internal: isAdminView ? internalNote : false,
        attachments,
      });
      setText('');
      setAttachments([]);
      if (isAdminView) setInternalNote(false);
      onSent?.();
    } catch (err) {
      toast({ title: 'Não foi possível enviar', description: err.message || 'Tente novamente.' });
    } finally {
      setSending(false);
    }
  };

  const closed = ['CLOSED'].includes(ticket?.status);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((m) => {
          const mine = isMine(m);
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm border ${
                m.is_internal
                  ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700'
                  : mine
                    ? 'bg-primary text-white border-primary rounded-br-md'
                    : 'bg-muted/60 border-border rounded-bl-md'
              }`}>
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className={`text-[11px] font-semibold ${mine && !m.is_internal ? 'text-white/90' : 'text-foreground'}`}>
                    {m.sender_name || m.sender_email || (m.sender_type === 'SUPPORT' ? 'Suporte' : 'Cliente')}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    m.sender_type === 'SUPPORT' ? 'bg-indigo-100 text-indigo-700' : m.sender_type === 'CUSTOMER' ? 'bg-slate-200 text-slate-600' : 'bg-muted text-muted-foreground'
                  }`}>
                    {m.sender_type === 'SUPPORT' ? 'Suporte' : m.sender_type === 'CUSTOMER' ? 'Cliente' : m.sender_type}
                  </span>
                  {m.is_internal && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-amber-200 text-amber-800">Nota interna</span>}
                </div>
                {m.message && <p className={`whitespace-pre-wrap break-words ${mine && !m.is_internal ? 'text-white' : 'text-foreground'}`}>{m.message}</p>}
                {(m.attachments || []).length > 0 && (
                  <div className={`mt-1.5 flex flex-wrap gap-1.5 ${mine && !m.is_internal ? '' : ''}`}>
                    {m.attachments.filter((a) => a.signed_url).map((a, i) => (
                      <a key={i} href={a.signed_url} target="_blank" rel="noreferrer"
                        className={`text-[11px] px-2 py-1 rounded-lg border font-medium ${
                          mine && !m.is_internal ? 'bg-white/15 border-white/30 text-white hover:bg-white/25' : 'bg-card border-border text-foreground hover:bg-muted'
                        }`}>
                        📎 {a.file_name}
                      </a>
                    ))}
                  </div>
                )}
                <p className={`text-[10px] mt-1 text-right ${mine && !m.is_internal ? 'text-white/70' : 'text-muted-foreground'}`}>
                  {fmtDateTime(m.created_date)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {!closed && (
        <div className="border-t border-border p-3 space-y-2 bg-card rounded-b-2xl">
          {isAdminView && (
            <div className="flex items-center gap-2">
              <Switch checked={internalNote} onCheckedChange={setInternalNote} id="internal-note" />
              <Label htmlFor="internal-note" className="text-xs text-muted-foreground">Nota interna (invisível ao cliente)</Label>
            </div>
          )}
          <Textarea
            value={text} onChange={(e) => setText(e.target.value)}
            placeholder={internalNote ? 'Anotação interna sobre o atendimento…' : 'Digite sua mensagem…'}
            rows={2} maxLength={5000}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } }}
          />
          <div className="flex items-center justify-between gap-2">
            <input ref={fileInput} type="file" multiple accept=".png,.jpg,.jpeg,.webp,.pdf,.xlsx,.csv" className="hidden"
              onChange={(e) => { pickFiles(e.target.files); e.target.value = ''; }} />
            <Button type="button" variant="ghost" size="sm" onClick={() => fileInput.current?.click()} disabled={uploading} className="gap-1.5">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
              Anexar {attachments.length ? `(${attachments.length})` : ''}
            </Button>
            <Button type="button" size="sm" onClick={send} disabled={sending || uploading || (!text.trim() && !attachments.length)} className="gap-1.5">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Enviar
            </Button>
          </div>
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {attachments.map((a, i) => (
                <span key={i} className="text-[11px] bg-muted border border-border rounded-full px-2 py-0.5 truncate max-w-[220px]">{a.file_name}</span>
              ))}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground text-right">{padTicketNumber(ticket?.ticket_number)} · Enter+Ctrl envia</p>
        </div>
      )}
    </div>
  );
}