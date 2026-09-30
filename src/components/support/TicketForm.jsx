import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Paperclip, Send, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supportDesk, uploadSupportAttachment, isAcceptedFile } from '@/lib/supportClient';
import { CATEGORY_OPTIONS, PRIORITY_OPTIONS } from '@/lib/supportConstants';

// Formulário de abertura de chamado — o usuário só descreve o problema;
// empresa, usuário, módulo, página, navegador e versão são contexto automático.
export default function TicketForm({ companyId, context = {}, onCreated, compact }) {
  const { toast } = useToast();
  const fileInput = useRef(null);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);

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

  const submit = async (e) => {
    e.preventDefault();
    if (subject.trim().length < 5) {
      toast({ title: 'Assunto muito curto', description: 'Descreva o problema em pelo menos 5 caracteres.' });
      return;
    }
    if (description.trim().length < 10) {
      toast({ title: 'Descrição muito curta', description: 'Detalhe o problema em pelo menos 10 caracteres.' });
      return;
    }
    setSending(true);
    try {
      const res = await supportDesk({
        action: 'create_ticket',
        company_id: companyId,
        subject: subject.trim(),
        description: description.trim(),
        category,
        priority,
        attachments,
        ...context,
      });
      toast({ title: 'Chamado criado', description: 'A equipe de suporte foi notificada.' });
      onCreated?.(res.ticket);
    } catch (err) {
      toast({ title: 'Não foi possível criar o chamado', description: err.message || 'Tente novamente.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Assunto</Label>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Resuma o problema em uma linha" maxLength={140} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Categoria</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Prioridade</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Descrição</Label>
        <Textarea
          value={description} onChange={(e) => setDescription(e.target.value)} rows={compact ? 3 : 5}
          placeholder="Descreva o que aconteceu. Se possível, indique o produto, ordem ou tela em que o problema apareceu."
          maxLength={5000}
        />
      </div>
      {context.module && (
        <p className="text-[11px] text-muted-foreground">
          Contexto enviado automaticamente: módulo <strong className="text-foreground">{context.module}</strong>
          {context.page_context ? ` · página ${context.page_context}` : ''} · {context.browser_context || ''}
        </p>
      )}
      <div className="space-y-1.5">
        <input ref={fileInput} type="file" multiple accept=".png,.jpg,.jpeg,.webp,.pdf,.xlsx,.csv" className="hidden"
          onChange={(e) => { pickFiles(e.target.files); e.target.value = ''; }} />
        <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()} disabled={uploading || attachments.length >= 5}>
          {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Paperclip className="w-4 h-4 mr-2" />}
          Anexar ({attachments.length}/5)
        </Button>
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {attachments.map((a, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-[11px] bg-muted border border-border rounded-full pl-2.5 pr-1 py-0.5 max-w-[220px]">
                <span className="truncate">{a.file_name}</span>
                <button type="button" onClick={() => setAttachments((arr) => arr.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-foreground">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={sending || uploading} className="gap-2">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Enviar chamado
        </Button>
      </div>
    </form>
  );
}