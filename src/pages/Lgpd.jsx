import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Plus, Download, FileText, Clock, CheckCircle2, XCircle, AlertCircle, Loader2, X } from 'lucide-react';
import { listMyPrivacyRequests, createPrivacyRequest, exportMyData } from '@/lib/privacyClient';
import { useToast } from '@/components/ui/use-toast';

const REQUEST_TYPES = [
  { value: 'acesso', label: 'Acesso aos dados', desc: 'Quero saber quais dados meus a plataforma trata.' },
  { value: 'correcao', label: 'Correção', desc: 'Quero corrigir dados meus que estão incorretos.' },
  { value: 'portabilidade', label: 'Portabilidade', desc: 'Quero receber meus dados em arquivo estruturado.' },
  { value: 'exclusao', label: 'Exclusão', desc: 'Quero solicitar a exclusão dos meus dados.' },
];

const STATUS_META = {
  RECEBIDA: { label: 'Recebida', icon: Clock, color: 'text-slate-600 bg-slate-100 border-slate-200' },
  EM_ANALISE: { label: 'Em análise', icon: AlertCircle, color: 'text-blue-700 bg-blue-50 border-blue-200' },
  AGUARDANDO_JURIDICO: { label: 'Aguardando jurídico', icon: AlertCircle, color: 'text-amber-700 bg-amber-50 border-amber-200' },
  CONCLUIDA: { label: 'Concluída', icon: CheckCircle2, color: 'text-green-700 bg-green-50 border-green-200' },
  RECUSADA: { label: 'Recusada', icon: XCircle, color: 'text-red-700 bg-red-50 border-red-200' },
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
}

export default function Lgpd() {
  const { toast } = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState('acesso');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await listMyPrivacyRequests();
      setRequests(data?.requests || []);
    } catch (e) {
      toast({ title: 'Erro ao carregar pedidos', description: e.response?.data?.error || e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (description.trim().length < 10) {
      toast({ title: 'Descreva o pedido', description: 'Mínimo de 10 caracteres.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const data = await createPrivacyRequest(type, description.trim());
      toast({ title: 'Pedido registrado', description: `Protocolo: ${data?.request?.protocol || '—'}` });
      setShowForm(false);
      setDescription('');
      load();
    } catch (err) {
      toast({ title: 'Não foi possível registrar', description: err.response?.data?.error || err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const data = await exportMyData();
      const blob = new Blob([JSON.stringify(data?.package || data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meus_dados_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Exportação concluída', description: 'O arquivo contém dados pessoais — proteja-o.' });
    } catch (err) {
      toast({ title: 'Erro na exportação', description: err.response?.data?.error || err.message, variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Privacidade e Direitos do Titular</h1>
            <p className="text-sm text-muted-foreground">Exerça seus direitos de acesso, correção, portabilidade e exclusão (LGPD, Art. 18).</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/privacidade" className="flex items-center gap-1.5 border border-border rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">
            <FileText className="w-3.5 h-3.5" /> Aviso de Privacidade
          </Link>
          <button onClick={handleExport} disabled={exporting} className="flex items-center gap-1.5 border border-border rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-60">
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Exportação individual (Meus dados)
          </button>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            A exclusão é uma <strong>solicitação</strong>, não uma ação imediata. Dados sujeitos a obrigações legais, fiscais ou contratuais podem ser mantidos ou anonimizados. O resultado será informado no protocolo. Nenhum dado é apagado automaticamente.
          </p>
        </div>
      </div>

      <div className="bg-muted/40 border border-border rounded-xl p-4">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Exportação individual (LGPD):</strong> o arquivo "Meus dados" contém apenas dados do titular autenticado. Logs de auditoria aparecem como metadados sanitizados (data, ação, entidade) — sem IPs, e-mails de terceiros ou empresas fora do seu vínculo. Este fluxo é distinto do backup administrativo da empresa.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Meus pedidos</h2>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Novo pedido
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <Shield className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Você ainda não registrou nenhum pedido de privacidade.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => {
            const meta = STATUS_META[r.status] || STATUS_META.RECEBIDA;
            const Icon = meta.icon;
            return (
              <div key={r.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{REQUEST_TYPES.find(t => t.value === r.request_type)?.label || r.request_type}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Protocolo <span className="font-mono">{r.protocol}</span> · {fmtDate(r.created_date)}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-xs font-medium border rounded-full px-2.5 py-0.5 ${meta.color}`}>
                    <Icon className="w-3 h-3" /> {meta.label}
                  </span>
                </div>
                <p className="text-sm text-foreground mt-2 line-clamp-2">{r.description}</p>
                {r.response_due_date && r.status !== 'CONCLUIDA' && r.status !== 'RECUSADA' && (
                  <p className="text-xs text-muted-foreground mt-2">Prazo de resposta: {fmtDate(r.response_due_date)} (Art. 19, LGPD)</p>
                )}
                {r.resolution && r.resolution.decision && (
                  <div className="mt-2 bg-muted/40 rounded-lg p-2 text-xs">
                    <p className="font-medium text-foreground">{r.resolution.decision}</p>
                    {r.resolution.reason && <p className="text-muted-foreground mt-0.5">{r.resolution.reason}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground">Novo pedido de privacidade</h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-2">
                {REQUEST_TYPES.map(t => (
                  <button key={t.value} type="button" onClick={() => setType(t.value)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${type === t.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                    <p className="text-sm font-medium text-foreground">{t.label}</p>
                    <p className="text-xs text-muted-foreground">{t.desc}</p>
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Descrição do pedido</label>
                <textarea required minLength={10} value={description} onChange={e => setDescription(e.target.value)}
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background min-h-[100px] focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Descreva o que você precisa (quais dados, qual correção, etc.)." />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-border rounded-lg py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted">Cancelar</button>
                <button type="submit" disabled={submitting} className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-60">
                  {submitting ? 'Registrando...' : 'Registrar pedido'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}